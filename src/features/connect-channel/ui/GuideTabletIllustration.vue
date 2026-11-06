<script lang="ts">
import { defineComponent, h, onMounted, onBeforeUnmount, ref, type PropType } from 'vue'
import type { AdaptiveGuideStep } from '../model/mobile-guide-steps'

function useIllustrationWidth(fallback: number) {
  const element = ref<HTMLElement | null>(null)
  const renderedWidth = ref(fallback)
  let observer: ResizeObserver | undefined
  onMounted(() => {
    if (!element.value) return
    renderedWidth.value = element.value.getBoundingClientRect().width || fallback
    if (typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver(([entry]) => {
      if (entry?.contentRect.width) renderedWidth.value = entry.contentRect.width
    })
    observer.observe(element.value)
  })
  onBeforeUnmount(() => observer?.disconnect())
  return { element, renderedWidth }
}

export default defineComponent({
  name: 'GuideTabletIllustration',
  props: {
    step: { type: Object as PropType<AdaptiveGuideStep>, required: true },
    assets: { type: Object as PropType<Record<string, string>>, required: true },
    zoom: Boolean,
  },
  setup(illustrationProps) {
    const asset = (kind: 'step' | 'focus', id: string) =>
      illustrationProps.assets[`../guide/${kind}-${id}.${kind === 'step' ? 'png' : 'svg'}`] ?? ''
    const { element, renderedWidth } = useIllustrationWidth(520)
    return () =>
      h(
        'span',
        { class: 'integration-guide-visual', ref: element, style: { aspectRatio: '520/336' } },
        [
          h(
            'span',
            {
              class: 'guide-native-shot',
              style: {
                width: '520px',
                height: '336px',
                transform: `scale(${renderedWidth.value / 520})`,
                transformOrigin: '0 0',
                borderRadius: `${illustrationProps.step.nativeShotRadius ?? 0}px`,
                overflow: 'hidden',
              },
            },
            [
              h('img', {
                src: asset('step', illustrationProps.step.shot),
                alt: '',
                width: 520,
                height: 336,
                loading: illustrationProps.zoom ? 'eager' : 'lazy',
                style: { position: 'absolute', inset: 0, objectFit: 'cover' },
              }),
              h('img', {
                src: asset('focus', illustrationProps.step.focus),
                alt: '',
                style: { position: 'absolute', inset: 0, maxWidth: 'none' },
              }),
              ...illustrationProps.step.frames.map((rect) =>
                h('span', {
                  class: 'guide-tablet-frame',
                  style: {
                    left: `${rect[0]}px`,
                    top: `${rect[1]}px`,
                    width: `${rect[2]}px`,
                    height: `${rect[3]}px`,
                    borderRadius: `${rect[4]}px`,
                  },
                }),
              ),
            ],
          ),
        ],
      )
  },
})
</script>

<style scoped>
.integration-guide-visual {
  display: block;
  position: relative;
  width: 100%;
  overflow: hidden;
  background: white;
}
.guide-native-shot,
.guide-tablet-frame {
  position: absolute;
}
.guide-tablet-frame {
  border: 1.5px solid var(--color-brand);
  pointer-events: none;
}
</style>
