import {
  ArrowBack as BackIcon, Assessment as ReportIcon, Checklist as RcmIcon, ExpandMore as ExpandIcon, FindInPage as FindingsIcon,
  Fingerprint as TrailIcon, Radar as ScopeIcon, Science as TestIcon,
} from '@mui/icons-material';
import { Box, Card, Collapse, Grid, Link, Stack, Typography, alpha } from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { api } from '../api';
import { Badge } from '../components/common';
import FieldworkTab from '../components/engagement/FieldworkTab';
import FindingsTab from '../components/engagement/FindingsTab';
import RcmTab from '../components/engagement/RcmTab';
import ReportTab from '../components/engagement/ReportTab';
import ScopeTab from '../components/engagement/ScopeTab';
import TrailTab from '../components/engagement/TrailTab';
import { tokens } from '../theme';
import type { Engagement, TrailBundle } from '../types';
import { PACK_STYLE } from './EngagementsPage';

const STEPS: { label: string; hint: string; icon: ReactNode }[] = [
  { label: 'Risk & scope', hint: 'Rank the library', icon: <ScopeIcon fontSize="small" /> },
  { label: 'Control matrix', hint: 'Risks, tests, samples', icon: <RcmIcon fontSize="small" /> },
  { label: 'Fieldwork', hint: 'TOD / TOE', icon: <TestIcon fontSize="small" /> },
  { label: 'Findings', hint: 'Draft & sign off', icon: <FindingsIcon fontSize="small" /> },
  { label: 'Report', hint: 'Approved only', icon: <ReportIcon fontSize="small" /> },
  { label: 'Audit trail', hint: 'Hash-chained', icon: <TrailIcon fontSize="small" /> },
];

export interface TabProps {
  engagement: Engagement;
  setEngagement: (e: Engagement) => void;
  run: (moduleId: string) => Promise<void>;
}

function GateSummary({ bundle }: { bundle: TrailBundle }) {
  const [open, setOpen] = useState(false);
  const count = (o: string) => bundle.qaActions.filter((a) => a.outcome === o).length;
  const fails = count('fail');
  const warns = count('warn');
  const tone = fails ? 'red' : warns ? 'amber' : 'green';
  const color = fails ? '#DC2626' : warns ? '#D97706' : '#16A34A';
  return (
    <Card sx={{ mb: 2.5, borderColor: alpha(color, 0.3), bgcolor: alpha(color, 0.03) }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ px: 2.5, py: 1.75 }}>
        <Badge tone={tone} dot>
          QA gates · {count('pass')} passed · {warns} warnings · {fails} failed
        </Badge>
        <Typography sx={{ fontSize: 13.5, color: 'text.secondary', flex: 1 }}>
          <b style={{ color: tokens.text }}>{bundle.moduleId}</b> ran as <code>{bundle.id}</code> on {bundle.provider.id}/{bundle.provider.model}
        </Typography>
        {bundle.qaActions.length > 0 && (
          <Link component="button" onClick={() => setOpen(!open)} sx={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center' }} underline="none">
            {open ? 'Hide' : 'View'} gate decisions <ExpandIcon fontSize="small" sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
          </Link>
        )}
      </Stack>
      <Collapse in={open}>
        <Stack spacing={0.75} sx={{ px: 2.5, pb: 2 }}>
          {bundle.qaActions.map((a, i) => (
            <Stack key={i} direction="row" spacing={1.25} alignItems="baseline">
              <Badge tone={a.outcome === 'fail' ? 'red' : a.outcome === 'warn' ? 'amber' : 'green'}>{a.gate}</Badge>
              <Typography sx={{ fontSize: 13 }}>
                <code>{a.target}</code> — {a.detail} {a.action !== 'none' && <b>→ {a.action}</b>}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Collapse>
    </Card>
  );
}

function StepTracker({ active, done, onSelect }: { active: number; done: boolean[]; onSelect: (i: number) => void }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' }, gap: 1.25, mb: 3 }}>
      {STEPS.map((s, i) => {
        const isActive = i === active;
        const isDone = done[i];
        return (
          <Box
            key={s.label}
            onClick={() => onSelect(i)}
            sx={{
              cursor: 'pointer', p: 1.5, borderRadius: 3, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.25, transition: 'all .15s',
              bgcolor: isActive ? tokens.ink : 'white',
              color: isActive ? 'white' : tokens.text,
              border: `1px solid ${isActive ? tokens.ink : tokens.border}`,
              boxShadow: isActive ? '0 12px 28px -14px rgba(11,18,32,.6)' : 'none',
              '&:hover': { borderColor: isActive ? tokens.ink : alpha(tokens.indigo, 0.4) },
            }}
          >
            <Box
              sx={{
                width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', flexShrink: 0,
                backgroundImage: isActive ? tokens.gradient : 'none',
                bgcolor: isActive ? undefined : isDone ? alpha(tokens.teal, 0.12) : '#F1F5F9',
                color: isActive ? 'white' : isDone ? tokens.teal : tokens.muted,
              }}
            >
              {s.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }} noWrap>
                {s.label}
              </Typography>
              <Typography sx={{ fontSize: 11.5, opacity: 0.65 }} noWrap>
                {isDone && i < 5 ? 'Done · ' : ''}
                {s.hint}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default function EngagementPage() {
  const { id } = useParams();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [tab, setTab] = useState(0);
  const [lastRun, setLastRun] = useState<TrailBundle | null>(null);

  const load = useCallback(() => api<Engagement>(`/engagements/${id}`).then(setEngagement), [id]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (moduleId: string) => {
    const res = await api<{ bundle: TrailBundle; engagement: Engagement }>(`/engagements/${id}/modules/${moduleId}/run`, { method: 'POST', body: {} });
    setEngagement(res.engagement);
    setLastRun(res.bundle);
  };

  if (!engagement) return null;
  const e = engagement;
  const done = [e.scope.length > 0, e.rcm.length > 0, Object.keys(e.testResults).length > 0, e.findings.length > 0, !!e.report, true];
  const props: TabProps = { engagement: e, setEngagement, run };
  const results = Object.values(e.testResults);
  const kpis = [
    ['In scope', e.scope.filter((s) => s.included).length],
    ['Tested', results.filter((r) => r.conclusion !== 'Not tested').length],
    ['Exceptions', results.filter((r) => r.conclusion === 'Ineffective' || r.conclusion === 'Design deficient').length],
    ['Findings', e.findings.length],
    ['Approved', e.findings.filter((f) => f.status === 'approved').length],
  ];

  return (
    <Box>
      <Link component={RouterLink} to="/engagements" underline="none" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 14, fontWeight: 600, mb: 2 }}>
        <BackIcon fontSize="small" /> All engagements
      </Link>

      <Card sx={{ mb: 3, overflow: 'hidden' }}>
        <Box sx={{ height: 4, backgroundImage: tokens.gradient }} />
        <Grid container>
          <Grid item xs={12} lg={7} sx={{ p: { xs: 2.5, md: 3.5 } }}>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
              {e.packIds.map((p) => {
                const st = PACK_STYLE[p];
                return (
                  <Badge key={p} tone="slate" sx={{ color: st?.color, bgcolor: alpha(st?.color ?? '#64748B', 0.08), borderColor: alpha(st?.color ?? '#64748B', 0.2), textTransform: 'capitalize' }}>
                    {p} pack
                  </Badge>
                );
              })}
              <Typography sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: 'text.secondary' }}>{e.id}</Typography>
            </Stack>
            <Typography variant="h4" sx={{ fontSize: { xs: 24, md: 30 } }}>
              {e.name}
            </Typography>
            <Typography sx={{ color: 'text.secondary', mt: 0.75 }}>
              {e.entity} · {e.site} · {e.periodFrom} → {e.periodTo}
            </Typography>
            <Typography sx={{ mt: 2, fontSize: 14, lineHeight: 1.6, color: tokens.text, maxWidth: 760 }}>
              <Box component="span" sx={{ fontWeight: 700 }}>Scope · </Box>
              {e.scopeStatement}
            </Typography>
          </Grid>
          <Grid item xs={12} lg={5} sx={{ p: { xs: 2.5, md: 3.5 }, bgcolor: '#F8FAFC', borderLeft: { lg: `1px solid ${tokens.border}` }, borderTop: { xs: `1px solid ${tokens.border}`, lg: 0 } }}>
            <Typography variant="subtitle2">Engagement at a glance</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mt: 1.5 }}>
              {kpis.map(([l, v]) => (
                <Box key={l}>
                  <Typography sx={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 28, lineHeight: 1.1 }}>{v}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{l}</Typography>
                </Box>
              ))}
            </Box>
          </Grid>
        </Grid>
      </Card>

      <StepTracker active={tab} done={done} onSelect={setTab} />

      {lastRun && tab < 5 && <GateSummary bundle={lastRun} />}

      {tab === 0 && <ScopeTab {...props} />}
      {tab === 1 && <RcmTab {...props} />}
      {tab === 2 && <FieldworkTab {...props} />}
      {tab === 3 && <FindingsTab {...props} />}
      {tab === 4 && <ReportTab {...props} />}
      {tab === 5 && <TrailTab {...props} />}
    </Box>
  );
}
