import { Search as SearchIcon } from '@mui/icons-material';
import { Alert, Card, Chip, InputAdornment, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { Badge, PageHeader, RiskChip } from '../components/common';
import type { Clause, ContentPack } from '../types';

export default function LibraryPage() {
  const [packs, setPacks] = useState<ContentPack[]>([]);
  const [packId, setPackId] = useState('food');
  const [view, setView] = useState(0);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ clauseId: string; score: number; clause: Clause }[]>([]);

  useEffect(() => {
    api<{ id: string }[]>('/packs').then((list) => Promise.all(list.map((p) => api<ContentPack>(`/packs/${p.id}`))).then(setPacks));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => (q.trim() ? api<typeof hits>(`/search?q=${encodeURIComponent(q)}`).then(setHits) : setHits([])), 250);
    return () => clearTimeout(t);
  }, [q]);

  const pack = packs.find((p) => p.id === packId);
  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="Grounding corpus"
        title="Content library"
        subtitle="Content packs hold the clause-level regulatory corpus, the control library and the evaluation set. Adding a sector or regulation means adding a pack, not changing the engine."
      />

      <Card sx={{ p: 2.5, background: `linear-gradient(135deg, rgba(79,70,229,.06), rgba(14,165,164,.06))` }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Try the grounding index</Typography>
        <TextField
          fullWidth
          placeholder='Test the grounding index, e.g. "audit trail not reviewed" or "mock recall"'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        />
        {hits.length > 0 && (
          <Table size="small" sx={{ mt: 1 }}>
            <TableBody>
              {hits.map((h) => (
                <TableRow key={h.clauseId}>
                  <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{h.score.toFixed(2)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <b>{h.clause.ref}</b> <Typography variant="caption" display="block">{h.clause.regulation}</Typography>
                  </TableCell>
                  <TableCell>
                    <b>{h.clause.title}.</b> {h.clause.summary}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Tabs value={packId} onChange={(_, v) => setPackId(v)}>
        {packs.map((p) => (
          <Tab key={p.id} value={p.id} label={`${p.name} v${p.version}`} />
        ))}
      </Tabs>
      {pack && (
        <>
          <Alert severity="warning" variant="outlined" sx={{ bgcolor: 'white' }}>{pack.disclaimer}</Alert>
          <Tabs value={view} onChange={(_, v) => setView(v)}>
            <Tab label={`Controls (${pack.controls.length})`} />
            <Tab label={`Clauses (${pack.clauses.length})`} />
            <Tab label={`Evaluation cases (${pack.evalCases.length})`} />
          </Tabs>
          <Card sx={{ overflow: "auto" }}>
            {view === 0 && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Control</TableCell>
                    <TableCell>Process area</TableCell>
                    <TableCell>Risk</TableCell>
                    <TableCell>Frequency</TableCell>
                    <TableCell>Cites</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pack.controls.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{c.id}</TableCell>
                      <TableCell>
                        <b>{c.title}</b>
                        <Typography variant="body2" color="text.secondary">{c.risk}</Typography>
                      </TableCell>
                      <TableCell>{c.processArea}</TableCell>
                      <TableCell><RiskChip rating={c.riskRating} /></TableCell>
                      <TableCell>{c.frequency}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{c.clauseRefs.join(', ')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {view === 1 && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Clause</TableCell>
                    <TableCell>Regulation / standard</TableCell>
                    <TableCell>Summary (paraphrased)</TableCell>
                    <TableCell>Review</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pack.clauses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}><b>{c.ref}</b><Typography variant="caption" display="block" sx={{ fontFamily: 'monospace' }}>{c.id}</Typography></TableCell>
                      <TableCell>{c.regulation}</TableCell>
                      <TableCell><b>{c.title}.</b> {c.summary}</TableCell>
                      <TableCell><Badge tone={c.reviewStatus === 'draft' ? 'amber' : 'green'} dot>{c.reviewStatus}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {view === 2 && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Case</TableCell>
                    <TableCell>Kind</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Expected</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pack.evalCases.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{c.id}</TableCell>
                      <TableCell>{c.kind}</TableCell>
                      <TableCell>{c.description}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{JSON.stringify(c.expected)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </Stack>
  );
}
