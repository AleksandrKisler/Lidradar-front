<script lang="ts">
import { defineComponent, h, onMounted, onBeforeUnmount, ref, type PropType } from 'vue'
import type { AdaptiveGuideStep, AdaptiveVisual, GuideRect } from '../model/mobile-guide-steps'

function rectStyle(rect: GuideRect, visual: AdaptiveVisual) {
  return {
    left: `${(rect[0] / visual.width) * 100}%`,
    top: `${(rect[1] / visual.height) * 100}%`,
    width: `${(rect[2] / visual.width) * 100}%`,
    height: `${(rect[3] / visual.height) * 100}%`,
    borderRadius: `${rect[4]}px`,
  }
}

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

// The final Figma illustration is code-native form content, not a raster screenshot.
// Keep it noninteractive inside the screenshot button; no live form/commands are mounted.
export default defineComponent({
  name: 'GuideAdaptiveIllustration',
  props: {
    step: { type: Object as PropType<AdaptiveGuideStep>, required: true },
    assets: { type: Object as PropType<Record<string, string>>, required: true },
    zoom: Boolean,
  },
  setup(illustrationProps) {
    const mobileAsset = (name: string) => illustrationProps.assets[`../guide-mobile/${name}`] ?? ''
    const { element, renderedWidth } = useIllustrationWidth(illustrationProps.step.visual!.width)
    return () => {
      const step = illustrationProps.step
      const visual = step.visual!
      const tablet = visual.width === 706
      const position = (x: number, y: number, w: number, height: number) =>
        rectStyle([x, y, w, height, 0], visual)
      const font = (size: number) => `${(size / visual.width) * 100}cqw`
      const nativeForm = () => {
        const x = tablet ? 29.34 : 21.046
        const w = tablet ? 647.319 : 299.908
        const fh = tablet ? 42.177 : 40.338
        const labelSize = tablet ? 14.67 : 14.031
        const icon = (name: string, x: number, y: number) =>
          h('img', {
            src: mobileAsset(`${tablet ? 'tablet-' : ''}${name}`),
            alt: '',
            style: {
              position: 'absolute',
              left: `${(x / visual.width) * 100}%`,
              top: `${(y / visual.height) * 100}%`,
              maxWidth: 'none',
            },
          })
        return [
          ...[
            ['Название подключения', tablet ? 22.005 : 21.046],
            ['Точка', tablet ? 107 : 104.86],
            ['Токен бота', tablet ? 196.37 : 186.17],
          ].map(([label, y]) =>
            h(
              'span',
              {
                class: 'guide-form-label',
                style: {
                  ...position(x, Number(y), w, tablet ? 18.338 : 17.538),
                  fontSize: font(labelSize),
                },
              },
              String(label),
            ),
          ),
          ...[
            ['Telegram · переписка клиентов', tablet ? 47.678 : 45.599],
            ['Вся организация', tablet ? 132.67 : 129.41],
            ['', tablet ? 222.04 : 211.846],
          ].map(([text, y]) =>
            h(
              'span',
              {
                class: 'guide-form-field',
                style: {
                  ...position(x, Number(y), w, fh),
                  borderRadius: font(tablet ? 8.252 : 7.892),
                  paddingInline: font(tablet ? 12.836 : 12.277),
                  fontSize: font(tablet ? 14.29 : 13.07),
                },
              },
              String(text),
            ),
          ),
          icon('select.svg', tablet ? 645.48 : 291.14, tablet ? 142.76 : 139.06),
          icon('eye.svg', tablet ? 643.66 : 289.38, tablet ? 232.13 : 221.49),
          icon('lock.svg', x, tablet ? 282.56 : 269.72),
          h(
            'span',
            {
              class: 'guide-form-security',
              style: {
                ...position(
                  x + (tablet ? 22.005 : 21.046),
                  tablet ? 282.56 : 269.72,
                  w - (tablet ? 22.005 : 21.046),
                  tablet ? 33 : 42.092,
                ),
                fontSize: font(tablet ? 11.003 : 10.523),
              },
            },
            'Токен выдаёт @BotFather. Передаётся один раз по защищённому соединению, шифруется и снова не показывается.',
          ),
          h(
            'span',
            {
              class: 'guide-form-submit',
              style: {
                ...position(
                  tablet ? 496.951 : x,
                  tablet ? 334.56 : 333.77,
                  tablet ? 179.709 : w,
                  fh,
                ),
                fontSize: font(tablet ? 15.59 : 14.91),
                borderRadius: font(tablet ? 8.252 : 7.892),
              },
            },
            'Подключить',
          ),
        ]
      }
      return h(
        'span',
        {
          class: 'integration-guide-visual',
          ref: element,
          style: { aspectRatio: `${visual.width}/${visual.height}` },
          'data-guide-illustration': visual.form ? 'LidRadar' : 'iPhone',
          'aria-hidden': 'true',
        },
        [
          ...(visual.form
            ? [
                h(
                  'span',
                  {
                    class: 'guide-native-form',
                    style: {
                      width: `${visual.width}px`,
                      height: `${visual.height}px`,
                      transform: `scale(${renderedWidth.value / visual.width})`,
                      transformOrigin: '0 0',
                    },
                  },
                  nativeForm(),
                ),
              ]
            : [
                h('img', {
                  src: mobileAsset(`step-${step.shot}.png`),
                  alt: '',
                  loading: illustrationProps.zoom ? 'eager' : 'lazy',
                  style: {
                    position: 'absolute',
                    left: 0,
                    width: '100%',
                    maxWidth: 'none',
                    height: `${(visual.imageHeight! / visual.height) * 100}%`,
                    top: `${(visual.imageTop! / visual.height) * 100}%`,
                    objectFit: 'contain',
                  },
                }),
              ]),
          ...visual.masks.map((rect) =>
            h('span', {
              class: 'guide-visual-mask',
              style: {
                ...rectStyle(rect, visual),
                background: visual.form ? 'rgb(0 0 0 / 28%)' : 'rgb(0 0 0 / 58%)',
              },
            }),
          ),
          ...visual.frames.map((rect) =>
            h('span', { class: 'guide-visual-frame', style: rectStyle(rect, visual) }),
          ),
        ],
      )
    }
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
  container-type: inline-size;
}
.integration-guide-visual > span {
  position: absolute;
}
.guide-native-form {
  display: block;
  container-type: inline-size;
}
.guide-native-form > span {
  position: absolute;
}
.guide-visual-frame {
  border: 1.754px solid #08f;
  pointer-events: none;
}
.guide-visual-mask {
  pointer-events: none;
}
.guide-form-label {
  color: #1d1d1f;
  font-weight: 500;
  line-height: 1.25;
  text-align: left;
}
.guide-form-field {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-line);
  color: #565b64;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.guide-form-security {
  text-align: left;
  color: #565b64;
  line-height: 1.334;
}
.guide-form-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0071e3;
  color: white;
  font-weight: 500;
}
</style>
