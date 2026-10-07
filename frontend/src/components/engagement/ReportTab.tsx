import { Download as DownloadIcon, PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TabProps } from '../../pages/EngagementPage';
import { ActionButton } from '../common';

export default function ReportTab({ engagement: e, run }: TabProps) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center" useFlexGap flexWrap="wrap">
        <ActionButton startIcon={<PlayArrowIcon />} action={() => run('report')}>
          {e.report ? 'Regenerate' : 'Generate'} report
        </ActionButton>
        {e.report && (
          <Button variant="outlined" startIcon={<DownloadIcon />} href={`/api/engagements/${e.id}/report.md`}>
            Report (.md)
          </Button>
        )}
        <Button variant="outlined" startIcon={<DownloadIcon />} href={`/api/engagements/${e.id}/findings.csv`}>
          Findings for QMS/GRC (.csv)
        </Button>
        <Typography color="text.secondary">Only approved findings are included.</Typography>
      </Stack>
      {e.report && (
        <Card variant="outlined" sx={{ p: { xs: 2, md: 4 } }}>
          <Box sx={{ '& table': { borderCollapse: 'collapse', my: 1 }, '& td, & th': { border: '1px solid #ddd', px: 1, py: 0.5, fontSize: 14 }, '& h1': { fontSize: 26 }, '& h2': { fontSize: 20, mt: 3 }, '& h3': { fontSize: 17 } }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{e.report.markdown}</ReactMarkdown>
          </Box>
        </Card>
      )}
    </Stack>
  );
}
