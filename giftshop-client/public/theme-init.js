// Applies the saved theme before the page paints, so dark mode doesn't flash. A separate file (not inline)
// so the Content Security Policy can forbid inline scripts.
try {
  var t = localStorage.getItem('theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
} catch (e) { /* storage blocked */ }
