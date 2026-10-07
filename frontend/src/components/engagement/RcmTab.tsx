import { ExpandMore as ExpandMoreIcon, PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Box, Grid, Stack, Typography } from '@mui/material';
import type { TabProps } from '../../pages/EngagementPage';
import { ActionButton, Badge, Citations, ModuleBar, RiskChip } from '../common';

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <Box>
      <Typography variant="subtitle2">{title}</Typography>
      <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
        {items.map((s, i) => (
          <li key={i}>
            <Typography variant="body2">{s}</Typography>
          </li>
        ))}
      </Box>
    </Box>
  );
}

export default function RcmTab({ engagement: e, run }: TabProps) {
  return (
    <Stack spacing={2}>
      <ModuleBar title="Control & Risk Writer" description={`${e.rcm.length} controls. Sample sizes follow frequency and inherent risk; citations are locked to the content pack.`}>
        <ActionButton startIcon={<PlayArrowIcon />} action={() => run('rcm')}>
          {e.rcm.length ? 'Regenerate matrix' : 'Generate matrix'}
        </ActionButton>
      </ModuleBar>
      <Box>
        {e.rcm.map((r) => (
          <Accordion key={r.id}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }} useFlexGap flexWrap="wrap">
                <Typography sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, color: 'text.secondary', minWidth: 100 }}>{r.controlId}</Typography>
                <Typography fontWeight={600} sx={{ flex: 1 }}>
                  {r.control}
                </Typography>
                <Badge tone="slate">{r.processArea}</Badge>
                <RiskChip rating={r.riskRating} />
                <Badge tone="indigo">{`${r.frequency} · sample ${r.sampleSize}`}</Badge>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={1.5}>
                    <Typography variant="body2">
                      <b>Risk:</b> {r.risk}
                    </Typography>
                    <Typography variant="body2">
                      <b>Objective:</b> {r.objective}
                    </Typography>
                    <Typography variant="body2">
                      <b>Type:</b> {r.type} · {r.nature}
                    </Typography>
                    <Citations citations={r.citations} />
                    <List title="Evidence expected" items={r.evidenceExpected} />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={1.5}>
                    <List title="Test of design (TOD)" items={r.testOfDesign} />
                    <List title="Test of operating effectiveness (TOE)" items={r.testOfEffectiveness} />
                    <List title="Checklist" items={r.checklist} />
                  </Stack>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Stack>
  );
}
