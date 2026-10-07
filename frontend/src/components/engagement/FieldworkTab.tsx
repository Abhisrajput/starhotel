import { PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { Alert, Card, CardContent, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { api } from '../../api';
import type { TabProps } from '../../pages/EngagementPage';
import type { Engagement, RcmRow, TestInput, TestResult } from '../../types';
import { ActionButton, ConclusionChip, ModuleBar, RiskChip } from '../common';

type Draft = { designAdequate: string; observation: string; evidenceRefs: string; sampleTested: string; exceptions: string };

const toDraft = (t?: TestInput): Draft => ({
  designAdequate: t ? (t.designAdequate === null ? 'na' : t.designAdequate ? 'yes' : 'no') : 'na',
  observation: t?.observation ?? '',
  evidenceRefs: t?.evidenceRefs.join(', ') ?? '',
  sampleTested: String(t?.sampleTested ?? 0),
  exceptions: String(t?.exceptions ?? 0),
});

function RowCard({ row, input, result, engagementId, onSaved }: { row: RcmRow; input?: TestInput; result?: TestResult; engagementId: string; onSaved: (e: Engagement) => void }) {
  const [d, setD] = useState<Draft>(toDraft(input));
  const set = (k: keyof Draft) => (ev: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: ev.target.value });
  const dirty = JSON.stringify(d) !== JSON.stringify(toDraft(input));

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }} useFlexGap flexWrap="wrap">
          <Typography sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, color: 'text.secondary' }}>{row.controlId}</Typography>
          <Typography fontWeight={600} sx={{ flex: 1 }}>
            {row.control}
          </Typography>
          <RiskChip rating={row.riskRating} />
          <ConclusionChip conclusion={result?.conclusion} />
        </Stack>
        <Grid container spacing={2}>
          <Grid item xs={12} md={2}>
            <TextField select fullWidth size="small" label="Design adequate?" value={d.designAdequate} onChange={set('designAdequate')}>
              <MenuItem value="na">Not assessed</MenuItem>
              <MenuItem value="yes">Yes</MenuItem>
              <MenuItem value="no">No</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} md={1.5}>
            <TextField fullWidth size="small" type="number" label={`Sample (plan ${row.sampleSize})`} value={d.sampleTested} onChange={set('sampleTested')} />
          </Grid>
          <Grid item xs={6} md={1.5}>
            <TextField fullWidth size="small" type="number" label="Exceptions" value={d.exceptions} onChange={set('exceptions')} />
          </Grid>
          <Grid item xs={12} md={7}>
            <TextField fullWidth size="small" label="Evidence references (comma separated)" placeholder={row.evidenceExpected.join(', ')} value={d.evidenceRefs} onChange={set('evidenceRefs')} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" multiline minRows={2} label="Observation" value={d.observation} onChange={set('observation')} />
          </Grid>
        </Grid>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1.5 }}>
          <ActionButton
            size="small"
            variant="outlined"
            disabled={!dirty}
            action={async () =>
              onSaved(
                await api<Engagement>(`/engagements/${engagementId}/tests/${row.id}`, {
                  method: 'PUT',
                  body: {
                    designAdequate: d.designAdequate === 'na' ? null : d.designAdequate === 'yes',
                    observation: d.observation,
                    evidenceRefs: d.evidenceRefs.split(',').map((s) => s.trim()).filter(Boolean),
                    sampleTested: Number(d.sampleTested) || 0,
                    exceptions: Number(d.exceptions) || 0,
                  },
                }),
              )
            }
          >
            Save record
          </ActionButton>
          {result && <Typography variant="body2" color="text.secondary">{result.rationale}</Typography>}
        </Stack>
        {result?.qaFlags.length ? (
          <Alert severity="warning" sx={{ mt: 1 }}>
            QA flags for reviewer: {result.qaFlags.join('; ')}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function FieldworkTab({ engagement: e, setEngagement, run }: TabProps) {
  return (
    <Stack spacing={2}>
      <ModuleBar title="Testing · TOD / TOE" description='Record what you tested, then run Testing. Evidence gates: no "Effective" without evidence, never "Effective" with exceptions.'>
        <ActionButton startIcon={<PlayArrowIcon />} action={() => run('testing')}>
          Run testing
        </ActionButton>
      </ModuleBar>
      {e.rcm.map((r) => (
        <RowCard key={`${r.id}-${e.testInputs[r.id]?.updatedAt ?? ''}`} row={r} input={e.testInputs[r.id]} result={e.testResults[r.id]} engagementId={e.id} onSaved={setEngagement} />
      ))}
    </Stack>
  );
}
