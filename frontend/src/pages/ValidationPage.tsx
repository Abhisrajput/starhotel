import { PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { Alert, Box, Card, CardContent, Chip, Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { ActionButton } from '../components/common';
import type { EvalReport } from '../types';

interface TraceRow {
  id: string;
  text: string;
  risk: string;
  verifiedBy: string[];
  covered: boolean;
}

export default function ValidationPage() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [trace, setTrace] = useState<TraceRow[]>([]);
  const loadTrace = () => api<{ rows: TraceRow[] }>('/validation/traceability').then((t) => setTrace(t.rows));

  useEffect(() => {
    loadTrace();
    api<EvalReport[]>('/eval/runs').then((runs) => runs[0] && api<EvalReport>(`/eval/runs/${runs[0].id}`).then(setReport));
  }, []);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={600}>
          Evaluation & validation
        </Typography>
        <Typography color="text.secondary">
          The evaluation harness replays expert-labelled cases from every content pack through the real modules and QA gates. Its results are test evidence for the validation package and the release check for any prompt, model or content change.
        </Typography>
      </Box>

      <Stack direction="row" spacing={2} alignItems="center">
        <ActionButton
          startIcon={<PlayArrowIcon />}
          action={async () => {
            setReport(await api<EvalReport>('/eval/run', { method: 'POST' }));
            await loadTrace();
          }}
        >
          Run evaluation harness
        </ActionButton>
        {report && (
          <Typography color="text.secondary">
            Last run {new Date(report.at).toLocaleString()} on {report.provider.id}/{report.provider.model}
          </Typography>
        )}
      </Stack>

      {report && (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography color="text.secondary">Overall</Typography>
                  <Typography variant="h4" fontWeight={700} color={report.passed === report.total ? 'success.main' : 'error.main'}>
                    {report.passed}/{report.total}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {Object.entries(report.byKind).map(([k, v]) => (
              <Grid item xs={12} md={3} key={k}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                      {k}
                    </Typography>
                    <Typography variant="h4" fontWeight={700}>
                      {v.passed}/{v.total}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Card variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Case</TableCell>
                  <TableCell>Pack</TableCell>
                  <TableCell>Kind</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>Detail</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.cases.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{c.id}</TableCell>
                    <TableCell>{c.packId}</TableCell>
                    <TableCell>{c.kind}</TableCell>
                    <TableCell>{c.description}</TableCell>
                    <TableCell>
                      <Chip size="small" color={c.passed ? 'success' : 'error'} label={c.passed ? 'PASS' : 'FAIL'} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{c.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <Box>
        <Typography variant="h6">Requirements traceability matrix</Typography>
        <Alert severity="info" sx={{ my: 1 }}>
          Skeleton of the GxP validation package: user requirements are linked to the automated tests and evaluation evidence that verify them. See backend/validation/README.md.
        </Alert>
        <Card variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Req</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Requirement</TableCell>
                <TableCell>Verified by</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trace.map((r) => (
                <TableRow key={r.id}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{r.id}</TableCell>
                  <TableCell>{r.risk}</TableCell>
                  <TableCell>{r.text}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {r.verifiedBy.length ? r.verifiedBy.map((v) => <div key={v}>{v}</div>) : <Chip size="small" color="error" label="NOT COVERED" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Box>
    </Stack>
  );
}
