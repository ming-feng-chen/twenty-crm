import net from 'node:net';

const encodeCommand = (args) =>
  `*${args.length}\r\n` +
  args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join('');

export const parseRedisReply = (buffer, offset = 0) => {
  const lineEnd = buffer.indexOf('\r\n', offset);

  if (lineEnd < 0) return undefined;

  const type = String.fromCharCode(buffer[offset]);
  const line = buffer.toString('utf8', offset + 1, lineEnd);
  const next = lineEnd + 2;

  switch (type) {
    case '+':
      return { value: line, next };
    case '-':
      return { value: new Error(line), next };
    case ':':
      return { value: Number(line), next };
    case '$': {
      const length = Number(line);

      if (length < 0) return { value: null, next };
      if (buffer.length < next + length + 2) return undefined;

      return {
        value: buffer.toString('utf8', next, next + length),
        next: next + length + 2,
      };
    }
    case '*': {
      const items = [];
      let cursor = next;

      for (let index = 0; index < Number(line); index++) {
        const item = parseRedisReply(buffer, cursor);

        if (!item) return undefined;
        items.push(item.value);
        cursor = item.next;
      }

      return { value: items, next: cursor };
    }
    default:
      throw new Error(`Unsupported Redis reply type ${type}`);
  }
};

const runCommands = (redisUrl, commands, timeoutMs = 5000) =>
  new Promise((resolve, reject) => {
    const url = new URL(redisUrl);
    const authCommands = url.password
      ? [
          [
            'AUTH',
            decodeURIComponent(url.username || 'default'),
            decodeURIComponent(url.password),
          ],
        ]
      : [];
    const allCommands = [...authCommands, ...commands];
    const replies = [];
    let buffer = Buffer.alloc(0);

    const socket = net.connect({
      host: url.hostname.replace(/^\[|\]$/g, ''),
      port: Number(url.port || 6379),
    });

    const fail = (error) => {
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(timeoutMs, () => fail(new Error('Redis timeout')));
    socket.on('error', fail);
    socket.on('connect', () =>
      socket.write(allCommands.map(encodeCommand).join('')),
    );
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      let parsed;

      while ((parsed = parseRedisReply(buffer))) {
        buffer = buffer.subarray(parsed.next);

        if (parsed.value instanceof Error) return fail(parsed.value);

        replies.push(parsed.value);

        if (replies.length === allCommands.length) {
          socket.end();

          return resolve(replies.slice(authCommands.length));
        }
      }
    });
  });

export const createActiveJobsCounter = ({ redisUrl, queuePrefix = 'bull' }) => {
  const countActiveJobs = async () => {
    const [activeKeys] = await runCommands(redisUrl, [
      ['KEYS', `${queuePrefix}:*:active`],
    ]);

    if (activeKeys.length === 0) return 0;

    const lengths = await runCommands(
      redisUrl,
      activeKeys.map((key) => ['LLEN', key]),
    );

    return lengths.reduce((total, length) => total + length, 0);
  };

  return { countActiveJobs };
};
