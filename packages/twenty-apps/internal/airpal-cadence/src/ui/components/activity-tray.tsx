import { Button, Notice } from 'src/ui/components/primitives';
import { useTheme } from 'src/ui/theme';

// "Just done": what this page did, newest first, each with its Undo. Twenty's
// snackbar cannot carry a button, so Undo lives here, where it stays until
// used or dismissed instead of vanishing after a few seconds.

export type UndoPlan =
  | { kind: 'touch'; touchId: string }
  | { kind: 'fields'; data: Record<string, unknown> };

export type Activity = {
  id: string;
  personId: string;
  personName: string;
  text: string;
  undo: UndoPlan | null;
  // Why there is no Undo, when there is none.
  noUndoReason: string | null;
  warnings: string[];
  status: 'done' | 'undoing' | 'undone' | 'undoFailed';
  error: string | null;
};

export const MAX_ACTIVITIES = 6;

export const ActivityTray = ({
  activities,
  onUndo,
  onDismiss,
}: {
  activities: readonly Activity[];
  onUndo: (activity: Activity) => void;
  onDismiss: (activity: Activity) => void;
}) => {
  const theme = useTheme();

  if (activities.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="activity-tray"
      style={{
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius,
        background: theme.backgroundSecondary,
        padding: '6px 10px',
        margin: '10px 0',
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: theme.textTertiary, letterSpacing: '0.04em' }}>
        Just done
      </div>
      <ul style={{ margin: '4px 0 0', padding: '0' }}>
        {activities.map((activity) => (
          <li key={activity.id} style={{ listStyle: 'none', padding: '4px 0', borderTop: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', alignItems: 'center' }}>
              <span style={{ flex: '1', minWidth: '200px', textDecoration: activity.status === 'undone' ? 'line-through' : 'none', color: activity.status === 'undone' ? theme.textTertiary : theme.text }}>
                <strong>{activity.personName}</strong>
                {`: ${activity.text}`}
              </span>
              {activity.status === 'undone' ? (
                <span style={{ fontSize: theme.smallFontSize, color: theme.textSecondary }}>Undone</span>
              ) : activity.undo === null ? (
                activity.noUndoReason === null ? null : (
                  <span style={{ fontSize: theme.smallFontSize, color: theme.textTertiary }}>
                    {activity.noUndoReason}
                  </span>
                )
              ) : (
                <Button
                  compact
                  testId="undo"
                  disabled={activity.status === 'undoing'}
                  onClick={() => onUndo(activity)}
                >
                  {activity.status === 'undoing' ? 'Undoing…' : 'Undo'}
                </Button>
              )}
              <Button compact variant="ghost" ariaLabel="Dismiss" onClick={() => onDismiss(activity)}>
                ×
              </Button>
            </div>
            {activity.warnings.map((warning) => (
              <div key={warning} style={{ marginTop: '4px' }}>
                <Notice tone="warning">{warning}</Notice>
              </div>
            ))}
            {activity.error === null ? null : (
              <div style={{ marginTop: '4px' }}>
                <Notice tone="error" title="Undo failed">
                  {activity.error}
                </Notice>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
