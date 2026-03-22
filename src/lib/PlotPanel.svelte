<script lang="ts">
  import { onMount } from "svelte";

  let {
    chartFn,
    args,
    title: _title = "",
  }: {
    chartFn: (el: HTMLElement, ...args: any[]) => Promise<any>;
    args: any[];
    title?: string;
  } = $props();

  let el: HTMLDivElement;
  let error = $state("");

  async function draw() {
    if (!el || !args?.length) return;
    error = "";
    try {
      await chartFn(el, ...args);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  onMount(draw);

  $effect(() => {
    args;
    draw();
  });
</script>

<div class="panel">
  {#if error}
    <div class="err">{error}</div>
  {/if}
  <div
    bind:this={el}
    class="plot"
  ></div>
</div>

<style>
  .panel {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    padding: 4px;
  }
  .plot {
    width: 100%;
    line-height: 0;
  }
  .plot :global(svg) {
    display: block;
  }
  .err {
    color: var(--red);
    font-size: 11px;
    padding: 8px;
  }
</style>
