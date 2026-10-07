import {
  Add as AddIcon, AccountBalance as CommonIcon, ArrowForward as ArrowIcon, Agriculture as FoodIcon, Gavel as ClauseIcon,
  PendingActions as PendingIcon, Science as PharmaIcon, TaskAlt as ApprovedIcon, WorkOutline as WorkIcon,
} from '@mui/icons-material';
import {
  Box, Button, Card, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Grid, LinearProgress, Stack, TextField, Typography, alpha,
} from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ActionButton, Badge, FieldLabel, StatTile } from '../components/common';
import { tokens } from '../theme';

interface Summary {
  id: string;
  name: string;
  entity: string;
  site: string;
  auditType: string;
  packIds: string[];
  stage: string;
  periodFrom: string;
  periodTo: string;
  findings: number;
  rcm: number;
  approved: number;
  awaitingSignOff: number;
  blocked: number;
  tested: number;
}

interface PackSummary {
  id: string;
  name: string;
  version: string;
  vertical: string;
  description: string;
  controlCount: number;
  clauseCount: number;
}

const STAGES = ['planning', 'rcm', 'fieldwork', 'findings', 'reporting'];
const STAGE_LABEL: Record<string, string> = { planning: 'Planning', rcm: 'Control matrix', fieldwork: 'Fieldwork', findings: 'Findings', reporting: 'Reporting' };

export const PACK_STYLE: Record<string, { icon: ReactNode; color: string }> = {
  common: { icon: <CommonIcon />, color: tokens.indigo },
  food: { icon: <FoodIcon />, color: '#0D9488' },
  pharma: { icon: <PharmaIcon />, color: '#7C3AED' },
};
const packStyle = (id: string) => PACK_STYLE[id] ?? { icon: <ClauseIcon />, color: '#64748B' };

const EMPTY = { name: '', entity: '', site: '', periodFrom: '', periodTo: '', auditType: '', scopeStatement: '', packIds: ['common'] as string[] };

function Hero({ onNew }: { onNew: () => void }) {
  return (
    <Box
      sx={{
        position: 'relative', overflow: 'hidden', borderRadius: 5, p: { xs: 3, md: 5 }, mb: 3, color: 'white',
        bgcolor: tokens.ink,
        backgroundImage: `radial-gradient(700px 320px at 0% 0%, rgba(79,70,229,.55), transparent 60%), radial-gradient(600px 320px at 100% 100%, rgba(14,165,164,.45), transparent 60%)`,
      }}
    >
      <Box sx={{ position: 'absolute', inset: 0, opacity: 0.12, backgroundImage: 'linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)', backgroundSize: '44px 44px', maskImage: 'radial-gradient(ellipse at 70% 40%, black, transparent 70%)' }} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'center' }} sx={{ position: 'relative' }}>
        <Box sx={{ flex: 1 }}>
          <Badge tone="teal" sx={{ color: '#5EEAD4', bgcolor: 'rgba(94,234,212,.12)', borderColor: 'rgba(94,234,212,.25)' }}>
            Food · Pharma · Any manufacturer
          </Badge>
          <Typography variant="h3" sx={{ mt: 2, fontSize: { xs: 28, md: 40 }, lineHeight: 1.1, maxWidth: 720 }}>
            Audit execution with the{' '}
            <Box component="span" sx={{ background: 'linear-gradient(90deg,#A5B4FC,#5EEAD4)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
              regulations built in
            </Box>
            .
          </Typography>
          <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,.72)', maxWidth: 640, fontSize: 16 }}>
            Scope, test and report against clause-level citations. Every draft passes QA gates, every sign-off is recorded, and every step is sealed into a verifiable audit trail.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'row', md: 'column' }} spacing={1.5}>
          <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={onNew} sx={{ px: 3 }}>
            New engagement
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

function EngagementCard({ e, onOpen }: { e: Summary; onOpen: () => void }) {
  const step = STAGES.indexOf(e.stage) + 1;
  return (
    <Card onClick={onOpen} sx={{ p: 2.75, cursor: 'pointer', height: '100%', transition: 'all .18s ease', '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(tokens.indigo, 0.35), boxShadow: '0 18px 40px -20px rgba(79,70,229,.35)' } }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        {e.packIds.map((p) => (
          <Box key={p} sx={{ width: 30, height: 30, borderRadius: 2, display: 'grid', placeItems: 'center', color: packStyle(p).color, bgcolor: alpha(packStyle(p).color, 0.1), '& svg': { fontSize: 17 } }}>
            {packStyle(p).icon}
          </Box>
        ))}
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: 'text.secondary' }}>{e.id}</Typography>
      </Stack>
      <Typography variant="h6" sx={{ fontSize: 18, lineHeight: 1.3 }}>
        {e.name}
      </Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 14, mt: 0.5 }}>
        {e.entity} · {e.site}
      </Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.25 }}>
        {e.auditType} · {e.periodFrom} → {e.periodTo}
      </Typography>

      <Box sx={{ mt: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{STAGE_LABEL[e.stage] ?? e.stage}</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Step {step} of 5</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={(step / 5) * 100} />
      </Box>

      <Stack direction="row" spacing={3} sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${tokens.border}` }}>
        {[
          ['Controls', e.rcm],
          ['Tested', e.tested],
          ['Findings', e.findings],
          ['Approved', e.approved],
        ].map(([l, v]) => (
          <Box key={l}>
            <Typography sx={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 20 }}>{v}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{l}</Typography>
          </Box>
        ))}
        <Box sx={{ flex: 1 }} />
        <ArrowIcon sx={{ alignSelf: 'center', color: tokens.indigo }} />
      </Stack>
    </Card>
  );
}

export default function EngagementsPage() {
  const [rows, setRows] = useState<Summary[]>([]);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const navigate = useNavigate();

  useEffect(() => {
    api<Summary[]>('/engagements').then(setRows);
    api<PackSummary[]>('/packs').then(setPacks);
  }, []);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const togglePack = (id: string) =>
    setForm({ ...form, packIds: form.packIds.includes(id) ? form.packIds.filter((p) => p !== id) : [...form.packIds, id] });

  const sum = (k: keyof Summary) => rows.reduce((s, r) => s + Number(r[k]), 0);

  return (
    <Box>
      <Hero onNew={() => setOpen(true)} />

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} md={3}>
          <StatTile label="Active engagements" value={rows.length} hint="Across all content packs" icon={<WorkIcon />} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatTile label="Regulatory clauses" value={packs.reduce((s, p) => s + p.clauseCount, 0)} hint={`${packs.reduce((s, p) => s + p.controlCount, 0)} library controls`} icon={<ClauseIcon />} tone="teal" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatTile label="Awaiting sign-off" value={sum('awaitingSignOff')} hint={`${sum('blocked')} blocked by QA gates`} icon={<PendingIcon />} tone="amber" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatTile label="Approved findings" value={sum('approved')} hint="Released to reports" icon={<ApprovedIcon />} tone="green" />
        </Grid>
      </Grid>

      <Stack direction="row" alignItems="baseline" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ flex: 1 }}>
          Engagements
        </Typography>
        <Button startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          New
        </Button>
      </Stack>
      <Grid container spacing={2} sx={{ mb: 5 }}>
        {rows.map((r) => (
          <Grid item xs={12} lg={6} key={r.id}>
            <EngagementCard e={r} onOpen={() => navigate(`/engagements/${r.id}`)} />
          </Grid>
        ))}
        {!rows.length && (
          <Grid item xs={12}>
            <Card sx={{ p: 5, textAlign: 'center', color: 'text.secondary' }}>
              No engagements yet. Run <code>npm run seed</code> in the backend for demo data, or create one.
            </Card>
          </Grid>
        )}
      </Grid>

      <Typography variant="h5" sx={{ mb: 0.5 }}>
        Content packs
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Regulations, control libraries and evaluation sets as data. Add a sector by adding a pack.
      </Typography>
      <Grid container spacing={2}>
        {packs.map((p) => {
          const st = packStyle(p.id);
          return (
            <Grid item xs={12} md={4} key={p.id}>
              <Card sx={{ p: 2.75, height: '100%', position: 'relative', overflow: 'hidden' }}>
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: st.color }} />
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: st.color, bgcolor: alpha(st.color, 0.1) }}>{st.icon}</Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{p.name}</Typography>
                    <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>v{p.version}</Typography>
                  </Box>
                </Stack>
                <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 1.75, mb: 2 }}>{p.description}</Typography>
                <Stack direction="row" spacing={1}>
                  <Badge tone="slate">{p.controlCount} controls</Badge>
                  <Badge tone="slate">{p.clauseCount} clauses</Badge>
                </Stack>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="h5">New audit engagement</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 14 }}>
            The Risk & Scope module ranks the control library against your scope statement.
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} sx={{ mt: 2 }}>
            <TextField label="Engagement name" value={form.name} onChange={set('name')} required />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Entity" value={form.entity} onChange={set('entity')} fullWidth required />
              <TextField label="Site / plant" value={form.site} onChange={set('site')} fullWidth required />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Audit type" placeholder="e.g. Food safety internal audit" value={form.auditType} onChange={set('auditType')} fullWidth required />
              <TextField label="Period from" type="date" InputLabelProps={{ shrink: true }} value={form.periodFrom} onChange={set('periodFrom')} required />
              <TextField label="Period to" type="date" InputLabelProps={{ shrink: true }} value={form.periodTo} onChange={set('periodTo')} required />
            </Stack>
            <TextField label="Scope statement" helperText="Processes, risks and areas in scope." value={form.scopeStatement} onChange={set('scopeStatement')} multiline minRows={3} required />
            <Box>
              <FieldLabel>Content packs</FieldLabel>
              <Grid container spacing={1.5}>
                {packs.map((p) => {
                  const on = form.packIds.includes(p.id);
                  const st = packStyle(p.id);
                  return (
                    <Grid item xs={12} sm={4} key={p.id}>
                      <Box
                        onClick={() => togglePack(p.id)}
                        sx={{ p: 1.5, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, border: `1.5px solid ${on ? st.color : tokens.border}`, bgcolor: on ? alpha(st.color, 0.05) : 'white', transition: 'all .15s' }}
                      >
                        <Box sx={{ color: st.color, display: 'flex' }}>{st.icon}</Box>
                        <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{p.name}</Typography>
                        <Checkbox checked={on} size="small" sx={{ p: 0 }} />
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <ActionButton
            action={async () => {
              const e = await api<{ id: string }>('/engagements', { method: 'POST', body: form });
              navigate(`/engagements/${e.id}`);
            }}
          >
            Create engagement
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
