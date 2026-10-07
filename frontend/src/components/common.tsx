import { Alert, Box, Button, Card, CircularProgress, Snackbar, Stack, Tooltip, Typography, alpha, type ButtonProps, type SxProps } from '@mui/material';
import { useState, type ReactNode } from 'react';
import { tokens } from '../theme';
import type { Citation, FindingStatus, RiskRating, TestConclusion } from '../types';

const TONES = {
  red: '#DC2626',
  amber: '#D97706',
  green: '#16A34A',
  blue: '#2563EB',
  indigo: tokens.indigo,
  teal: tokens.teal,
  slate: '#64748B',
} as const;
export type Tone = keyof typeof TONES;

/** Soft tinted badge with an optional status dot. */
export function Badge({ tone, children, dot, sx }: { tone: Tone; children: ReactNode; dot?: boolean; sx?: SxProps }) {
  const c = TONES[tone];
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.25, borderRadius: 1.5, fontSize: 12, fontWeight: 600, lineHeight: '20px', whiteSpace: 'nowrap', color: c, bgcolor: alpha(c, 0.1), border: `1px solid ${alpha(c, 0.18)}`, ...sx }}
    >
      {dot && <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c }} />}
      {children}
    </Box>
  );
}

export function RiskChip({ rating }: { rating: RiskRating }) {
  return <Badge tone={rating === 'High' ? 'red' : rating === 'Medium' ? 'amber' : 'green'}>{rating}</Badge>;
}

export function ConclusionChip({ conclusion }: { conclusion?: TestConclusion }) {
  if (!conclusion) return <Badge tone="slate">Not concluded</Badge>;
  const tone: Tone = conclusion === 'Effective' ? 'green' : conclusion === 'Not tested' ? 'slate' : 'red';
  return <Badge tone={tone} dot>{conclusion}</Badge>;
}

export function StatusChip({ status }: { status: FindingStatus }) {
  const tone: Tone = { draft: 'slate', blocked: 'red', reviewed: 'blue', approved: 'green', rejected: 'amber' }[status] as Tone;
  return <Badge tone={tone} dot sx={{ textTransform: 'capitalize' }}>{status}</Badge>;
}

export function Citations({ citations }: { citations: Citation[] }) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      {citations.map((c) => (
        <Tooltip key={c.clauseId} title={c.regulation} arrow>
          <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 1.5, fontSize: 11.5, fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: tokens.indigo, bgcolor: alpha(tokens.indigo, 0.06), border: `1px solid ${alpha(tokens.indigo, 0.16)}`, whiteSpace: 'nowrap' }}>
            {c.label}
          </Box>
        </Tooltip>
      ))}
    </Stack>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-end' }} sx={{ mb: 3 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="overline" sx={{ color: tokens.indigo, fontSize: 11.5 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" sx={{ fontSize: { xs: 26, md: 32 } }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 820, fontSize: 15 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Stack direction="row" spacing={1.5}>{actions}</Stack>}
    </Stack>
  );
}

export function StatTile({ label, value, hint, icon, tone = 'indigo' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <Card sx={{ p: 2.5, height: '100%' }}>
      <Stack direction="row" alignItems="flex-start" spacing={2}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
          <Typography sx={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', mt: 0.5, lineHeight: 1.1 }}>{value}</Typography>
          {hint && <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.75 }}>{hint}</Typography>}
        </Box>
        {icon && <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: c, bgcolor: alpha(c, 0.1) }}>{icon}</Box>}
      </Stack>
    </Card>
  );
}

/** Small uppercase label used above field groups. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{children}</Typography>;
}

/** Button that runs an async action, shows progress and surfaces API errors. */
export function ActionButton({ action, children, ...props }: { action: () => Promise<unknown>; children: ReactNode } & Omit<ButtonProps, 'onClick'>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        variant="contained"
        disabled={busy || props.disabled}
        startIcon={busy ? <CircularProgress size={16} color="inherit" /> : props.startIcon}
        {...props}
        onClick={async () => {
          setBusy(true);
          try {
            await action();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {children}
      </Button>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" variant="filled" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}

/** Header strip at the top of each module tab: what the module does and its actions. */
export function ModuleBar({ title, description, children }: { title: string; description: ReactNode; children?: ReactNode }) {
  return (
    <Card sx={{ p: { xs: 2, md: 2.5 }, mb: 2.5 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontSize: 18 }}>{title}</Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.25 }}>{description}</Typography>
        </Box>
        <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">{children}</Stack>
      </Stack>
    </Card>
  );
}
