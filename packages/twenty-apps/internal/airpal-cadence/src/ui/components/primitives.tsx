import { type CSSProperties, type ReactNode } from 'react';

import { type Theme, ThemeContext, themeFor, useTheme } from 'src/ui/theme';

// Small building blocks in Twenty's look. Plain HTML only: front components
// render through a sandbox that supports standard elements and inline styles
// (no stylesheets, no :hover, no popovers), so menus open inline.

export const ThemeRoot = ({
  scheme,
  children,
  testId,
  fill = true,
}: {
  scheme: 'light' | 'dark';
  children: ReactNode;
  testId?: string;
  fill?: boolean;
}) => {
  const theme = themeFor(scheme);

  return (
    <ThemeContext.Provider value={theme}>
      <div
        data-testid={testId}
        style={{
          fontFamily: theme.font,
          fontSize: theme.fontSize,
          lineHeight: '1.45',
          color: theme.text,
          background: theme.background,
          boxSizing: 'border-box',
          ...(fill ? { height: '100%', overflowY: 'auto' } : {}),
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';

const buttonStyle = (
  theme: Theme,
  variant: ButtonVariant,
  disabled: boolean,
  compact: boolean,
): CSSProperties => {
  const base: CSSProperties = {
    fontFamily: theme.font,
    fontSize: compact ? theme.smallFontSize : theme.fontSize,
    fontWeight: 500,
    lineHeight: '1.2',
    padding: compact ? '3px 8px' : '5px 10px',
    borderRadius: theme.radius,
    border: `1px solid ${theme.borderStrong}`,
    background: theme.background,
    color: theme.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? '0.5' : '1',
    whiteSpace: 'nowrap',
  };

  switch (variant) {
    case 'primary':
      return { ...base, background: theme.accent, borderColor: theme.accent, color: theme.accentText };
    case 'danger':
      return { ...base, background: theme.danger, borderColor: theme.danger, color: '#ffffff' };
    case 'ghost':
      return { ...base, borderColor: 'transparent', background: 'transparent', color: theme.textSecondary };
    case 'link':
      return {
        ...base,
        border: 'none',
        background: 'transparent',
        padding: '0',
        color: theme.textSecondary,
        textDecoration: 'underline',
        fontWeight: 400,
      };
    default:
      return base;
  }
};

export const Button = ({
  children,
  onClick,
  variant = 'secondary',
  disabled = false,
  compact = false,
  title,
  ariaLabel,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  title?: string;
  ariaLabel?: string;
  testId?: string;
}) => {
  const theme = useTheme();

  return (
    <button
      type="button"
      data-testid={testId}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onClick();
        }
      }}
      style={buttonStyle(theme, variant, disabled, compact)}
    >
      {children}
    </button>
  );
};

const inputStyle = (theme: Theme, width?: string, invalid = false): CSSProperties => ({
  fontFamily: theme.font,
  fontSize: theme.fontSize,
  color: theme.text,
  background: theme.background,
  border: `1px solid ${invalid ? theme.danger : theme.borderStrong}`,
  borderRadius: theme.radius,
  padding: '4px 8px',
  boxSizing: 'border-box',
  width: width ?? 'auto',
  minWidth: '0',
});

export const TextInput = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  ariaLabel,
  width,
  disabled = false,
  invalid = false,
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'date' | 'number';
  ariaLabel?: string;
  width?: string;
  disabled?: boolean;
  invalid?: boolean;
  testId?: string;
}) => {
  const theme = useTheme();

  return (
    <input
      type={type}
      data-testid={testId}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      style={inputStyle(theme, width, invalid)}
    />
  );
};

export const TextArea = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  rows = 2,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  rows?: number;
  disabled?: boolean;
}) => {
  const theme = useTheme();

  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      style={{ ...inputStyle(theme, '100%'), resize: 'vertical' }}
    />
  );
};

export type SelectOption = { value: string; label: string; disabled?: boolean };

export const Select = ({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
  width,
  invalid = false,
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  ariaLabel?: string;
  disabled?: boolean;
  width?: string;
  invalid?: boolean;
  testId?: string;
}) => {
  const theme = useTheme();

  return (
    <select
      value={value}
      data-testid={testId}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      style={inputStyle(theme, width, invalid)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export const Checkbox = ({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) => (
  <label
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      cursor: disabled ? 'default' : 'pointer',
    }}
  >
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
    <span>{label}</span>
  </label>
);

export const Radio = ({
  name,
  checked,
  onChange,
  label,
  description,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: ReactNode;
  description?: ReactNode;
}) => {
  const theme = useTheme();

  return (
    <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer' }}>
      <input type="radio" name={name} checked={checked} onChange={() => onChange()} />
      <span>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {description === undefined ? null : (
          <span style={{ display: 'block', color: theme.textSecondary, fontSize: theme.smallFontSize }}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
};

export const Field = ({
  label,
  help,
  errors,
  children,
}: {
  label: ReactNode;
  help?: ReactNode;
  errors?: readonly string[];
  children: ReactNode;
}) => {
  const theme = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{ fontSize: theme.smallFontSize, fontWeight: 600, color: theme.textSecondary }}>
        {label}
      </span>
      {children}
      {help === undefined ? null : (
        <span style={{ fontSize: theme.smallFontSize, color: theme.textTertiary }}>{help}</span>
      )}
      {(errors ?? []).map((error) => (
        <span key={error} role="alert" style={{ fontSize: theme.smallFontSize, color: theme.danger }}>
          {error}
        </span>
      ))}
    </div>
  );
};

export type Tone = 'error' | 'warning' | 'info' | 'success';

export const Notice = ({
  tone,
  title,
  children,
  testId,
}: {
  tone: Tone;
  title?: ReactNode;
  children?: ReactNode;
  testId?: string;
}) => {
  const theme = useTheme();
  const colours: Record<Tone, { text: string; background: string; border: string }> = {
    error: { text: theme.danger, background: theme.dangerBackground, border: theme.dangerBorder },
    warning: { text: theme.warning, background: theme.warningBackground, border: theme.warning },
    info: { text: theme.textSecondary, background: theme.backgroundTertiary, border: theme.border },
    success: { text: theme.success, background: theme.successBackground, border: theme.success },
  };
  const colour = colours[tone];

  return (
    <div
      data-testid={testId}
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        border: `1px solid ${colour.border}`,
        background: colour.background,
        borderRadius: theme.radius,
        padding: '8px 10px',
        fontSize: theme.smallFontSize,
        color: theme.text,
        whiteSpace: 'pre-line',
      }}
    >
      {title === undefined ? null : (
        <div style={{ fontWeight: 600, color: colour.text, marginBottom: children === undefined ? '0' : '2px' }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
};

export const Badge = ({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) => {
  const theme = useTheme();
  const colour: Record<Tone, [string, string]> = {
    error: [theme.danger, theme.dangerBackground],
    warning: [theme.warning, theme.warningBackground],
    info: [theme.textSecondary, theme.backgroundTertiary],
    success: [theme.success, theme.successBackground],
  };

  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: theme.smallFontSize,
        fontWeight: 500,
        padding: '1px 6px',
        borderRadius: theme.radius,
        color: colour[tone][0],
        background: colour[tone][1],
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
};

export const Muted = ({ children }: { children: ReactNode }) => {
  const theme = useTheme();

  return <span style={{ color: theme.textSecondary }}>{children}</span>;
};

export const Inline = ({
  children,
  gap = '6px',
  wrap = true,
  align = 'center',
}: {
  children: ReactNode;
  gap?: string;
  wrap?: boolean;
  align?: CSSProperties['alignItems'];
}) => (
  <div style={{ display: 'flex', flexWrap: wrap ? 'wrap' : 'nowrap', gap, alignItems: align }}>
    {children}
  </div>
);

export const Stack = ({ children, gap = '8px' }: { children: ReactNode; gap?: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap }}>{children}</div>
);

// An inline panel under a row: the sandbox has no popovers or modals.
export const Panel = ({
  title,
  children,
  onClose,
  testId,
}: {
  title: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  testId?: string;
}) => {
  const theme = useTheme();

  return (
    <div
      data-testid={testId}
      style={{
        border: `1px solid ${theme.border}`,
        background: theme.backgroundSecondary,
        borderRadius: theme.radius,
        padding: '10px 12px',
        marginTop: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontWeight: 600 }}>{title}</span>
        {onClose === undefined ? null : (
          <Button variant="ghost" compact onClick={onClose} ariaLabel="Close">
            Close
          </Button>
        )}
      </div>
      {children}
    </div>
  );
};

export const SectionHeading = ({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: Tone;
}) => {
  const theme = useTheme();

  return (
    <div
      style={{
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color:
          tone === 'error' ? theme.danger : tone === 'warning' ? theme.warning : theme.textTertiary,
        margin: '14px 0 6px',
      }}
    >
      {children}
    </div>
  );
};
