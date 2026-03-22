<script lang="ts">
  import { BLUE, GREEN, MUTED } from "$lib/theme.js";

  let { value, onchange }: { value: string; onchange: (v: string) => void } = $props();

  const options = [
    { key: "ALL", label: "All" },
    { key: "HK", label: "HK" },
    { key: "SG", label: "SG" },
  ];

  const activeColor: Record<string, string> = { ALL: MUTED, HK: BLUE, SG: GREEN };
</script>

<div class="filter">
  <span class="label">Region</span>
  <div class="seg">
    {#each options as opt (opt.key)}
      <button
        class="seg-btn"
        class:active={value === opt.key}
        style:--active-color={activeColor[opt.key]}
        onclick={() => onchange(opt.key)}
      >
        {opt.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .filter {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .label {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  .seg {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  .seg-btn {
    background: transparent;
    border: none;
    border-right: 1px solid var(--border);
    color: var(--muted);
    font-family: inherit;
    font-size: 11px;
    font-weight: 500;
    padding: 5px 14px;
    cursor: pointer;
    transition:
      background 0.12s,
      color 0.12s;
  }
  .seg-btn:last-child {
    border-right: none;
  }
  .seg-btn:hover:not(.active) {
    background: var(--card-bg);
    color: var(--text);
  }
  .seg-btn.active {
    background: color-mix(in srgb, var(--active-color) 15%, transparent);
    color: var(--active-color);
    font-weight: 700;
  }
</style>
