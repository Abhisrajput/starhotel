import { Download as DownloadIcon, PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { download } from '../../api';
import type { TabProps } from '../../pages/EngagementPage';
import { ActionButton, ModuleBar } from '../common';

export default function ReportTab({ engagement: e, run }: TabProps) {
  return (
    <Stack spacing={0}>
      <ModuleBar title="Report Writer" description="Compiles the report from approved findings only. Export for review or write back to the QMS / GRC system of record.">
        {e.report && (
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => download(`/engagements/${e.id}/report.md`, `${e.id}-report.md`)}>
            Report (.md)
          </Button>
        )}
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => download(`/engagements/${e.id}/findings.csv`, `${e.id}-findings.csv`)}>
          Findings (.csv)
        </Button>
        <ActionButton startIcon={<PlayArrowIcon />} action={() => run('report')}>
          {e.report ? 'Regenerate report' : 'Generate report'}
        </ActionButton>
      </ModuleBar>
      {e.report && (
        <Card sx={{ p: { xs: 2.5, md: 6 }, maxWidth: 980, mx: 'auto', width: '100%' }}>
          <Box
            sx={{
              fontSize: 15, lineHeight: 1.7, color: '#1E293B',
              '& h1': { fontFamily: 'Plus Jakarta Sans', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, mt: 0, pb: 2, borderBottom: '3px solid', borderImage: 'linear-gradient(90deg,#4F46E5,#0EA5A4) 1' },
              '& h2': { fontFamily: 'Plus Jakarta Sans', fontSize: 20, fontWeight: 700, mt: 4, mb: 1 },
              '& h3': { fontFamily: 'Plus Jakarta Sans', fontSize: 16.5, fontWeight: 700, mt: 3, p: 1.5, borderRadius: 2, bgcolor: '#F8FAFC', borderLeft: '4px solid #4F46E5' },
              '& table': { borderCollapse: 'separate', borderSpacing: 0, my: 2, width: '100%', border: '1px solid #E6E9F2', borderRadius: 2, overflow: 'hidden' },
              '& th': { bgcolor: '#F8FAFC', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748B' },
              '& td, & th': { px: 1.5, py: 1, borderBottom: '1px solid #E6E9F2', fontSize: 14 },
              '& tr:last-child td': { borderBottom: 0 },
              '& hr': { border: 0, borderTop: '1px solid #E6E9F2', my: 3 },
              '& code': { fontSize: 13 },
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{e.report.markdown}</ReactMarkdown>
          </Box>
        </Card>
      )}
    </Stack>
  );
}
