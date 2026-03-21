<script>
  import "@fontsource/geist-sans";
  import favicon from "$lib/assets/favicon.svg";

  let { children } = $props();
</script>

<svelte:head>
  <link
    rel="icon"
    href={favicon}
  />
</svelte:head>

{@render children()}

<style>
  :global(html, body) {
    margin: 0;
    min-height: 100%;
    background: #0d1117;
    color: #e6edf3;
    font-family:
      "Geist Sans",
      system-ui,
      -apple-system,
      "Segoe UI",
      Roboto,
      sans-serif;
  }

  :global(*) {
    box-sizing: border-box;
  }
</style>
