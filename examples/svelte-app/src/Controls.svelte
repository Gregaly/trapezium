<script lang="ts">
  /**
   * The switches above the table.
   *
   * Part of the example rather than the library: a table library has no
   * business shipping a settings panel. What it is for is trying the props
   * without editing code.
   */
  type Segment = { label: string; value: string; options: { value: string; label: string }[] }
  type Toggle = { label: string; value: boolean }

  let {
    segments = [],
    switches = [],
    onsegment,
    onswitch,
  }: {
    segments?: Segment[]
    switches?: Toggle[]
    onsegment?: (label: string, value: string) => void
    onswitch?: (label: string, value: boolean) => void
  } = $props()
</script>

<div class="controls">
  {#each segments as segment (segment.label)}
    <div class="segmented">
      <span class="segmented-label">{segment.label}</span>
      <div class="segmented-options" role="group" aria-label={segment.label}>
        {#each segment.options as option (option.value)}
          <button
            type="button"
            data-active={option.value === segment.value}
            aria-pressed={option.value === segment.value}
            onclick={() => onsegment?.(segment.label, option.value)}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>
  {/each}

  {#each switches as toggle (toggle.label)}
    <label class="switch">
      <input
        type="checkbox"
        checked={toggle.value}
        onchange={(event) => onswitch?.(toggle.label, event.currentTarget.checked)}
      />
      <span class="switch-track" aria-hidden="true"></span>
      <span>{toggle.label}</span>
    </label>
  {/each}
</div>
