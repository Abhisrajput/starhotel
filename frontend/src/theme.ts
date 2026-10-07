import { alpha, createTheme } from '@mui/material';

// Design tokens. Deep navy chrome, indigo-to-teal "tide" accent, soft
// bordered surfaces and generous spacing.
export const tokens = {
  ink: '#0B1220',
  inkSoft: '#111A2E',
  indigo: '#4F46E5',
  teal: '#0EA5A4',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E6E9F2',
  surface: '#FFFFFF',
  canvas: '#F5F7FB',
  gradient: 'linear-gradient(135deg, #4F46E5 0%, #2563EB 45%, #0EA5A4 100%)',
  gradientSoft: 'linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(14,165,164,0.08) 100%)',
};

const display = '"Plus Jakarta Sans", "Inter Variable", system-ui, sans-serif';

export const theme = createTheme({
  palette: {
    primary: { main: tokens.indigo },
    secondary: { main: tokens.teal },
    success: { main: '#16A34A' },
    warning: { main: '#D97706' },
    error: { main: '#DC2626' },
    info: { main: '#2563EB' },
    background: { default: tokens.canvas, paper: tokens.surface },
    text: { primary: tokens.text, secondary: tokens.muted },
    divider: tokens.border,
  },
  shape: { borderRadius: 4 }, // sx radius units multiply this
  typography: {
    fontFamily: '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    h1: { fontFamily: display, fontWeight: 800, letterSpacing: '-0.03em' },
    h2: { fontFamily: display, fontWeight: 800, letterSpacing: '-0.025em' },
    h3: { fontFamily: display, fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontFamily: display, fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontFamily: display, fontWeight: 700, letterSpacing: '-0.015em' },
    h6: { fontFamily: display, fontWeight: 700, letterSpacing: '-0.01em' },
    subtitle2: { fontWeight: 600, color: tokens.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
    overline: { fontWeight: 700, letterSpacing: '0.12em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: tokens.canvas, WebkitFontSmoothing: 'antialiased' },
        '::selection': { background: alpha(tokens.indigo, 0.18) },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, paddingInline: 16, minHeight: 38 },
        containedPrimary: {
          backgroundImage: tokens.gradient,
          boxShadow: `0 6px 16px -6px ${alpha(tokens.indigo, 0.55)}`,
          '&:hover': { backgroundImage: tokens.gradient, filter: 'brightness(1.06)', boxShadow: `0 8px 20px -6px ${alpha(tokens.indigo, 0.6)}` },
          '&.Mui-disabled': { backgroundImage: 'none' },
        },
        outlined: { borderColor: tokens.border, color: tokens.text, backgroundColor: tokens.surface, '&:hover': { borderColor: alpha(tokens.indigo, 0.5), backgroundColor: alpha(tokens.indigo, 0.04) } },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: `1px solid ${tokens.border}`, borderRadius: 16, boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.08)' },
      },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 16 } } },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600, fontSize: 12 },
        sizeSmall: { height: 24 },
        outlined: { borderColor: tokens.border, backgroundColor: tokens.surface },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44, borderBottom: `1px solid ${tokens.border}` },
        indicator: { height: 3, borderRadius: 3, backgroundImage: tokens.gradient },
      },
    },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, fontSize: 14, minHeight: 44, color: tokens.muted, '&.Mui-selected': { color: tokens.text } } } },
    MuiTableHead: {
      styleOverrides: {
        root: { '& .MuiTableCell-head': { backgroundColor: '#F8FAFC', color: tokens.muted, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${tokens.border}` } },
      },
    },
    MuiTableCell: { styleOverrides: { root: { borderBottom: `1px solid ${tokens.border}`, paddingTop: 12, paddingBottom: 12 } } },
    MuiTableRow: { styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: alpha(tokens.indigo, 0.03) } } } },
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0 },
      styleOverrides: {
        root: { border: `1px solid ${tokens.border}`, borderRadius: 14, marginBottom: 10, '&:before': { display: 'none' }, '&.Mui-expanded': { boxShadow: '0 8px 24px -12px rgba(15,23,42,0.12)' } },
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12, alignItems: 'center' } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 10, backgroundColor: tokens.surface, '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.border } },
      },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { height: 6, borderRadius: 6, backgroundColor: alpha(tokens.indigo, 0.1) }, bar: { borderRadius: 6, backgroundImage: tokens.gradient } },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 20 } } },
    MuiStepIcon: { styleOverrides: { root: { '&.Mui-completed': { color: tokens.teal }, '&.Mui-active': { color: tokens.indigo } } } },
  },
});
