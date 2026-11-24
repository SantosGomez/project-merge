<script>
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)
const WIPES = {
  up: 'linear-gradient(to top, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
  down: 'linear-gradient(to bottom, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
  left: 'linear-gradient(to left, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
  right:
    'linear-gradient(to right, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
  center:
    'radial-gradient(farthest-corner at 50% 50%, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
}
</script>

<script setup>
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
const props = defineProps({
  container: {
    type: [Object, String],
    default: null,
  },
  distance: {
    type: Number,
    default: 100,
  },
  direction: {
    type: String,
    default: 'vertical',
  },
  reverse: {
    type: Boolean,
    default: false,
  },
  duration: {
    type: Number,
    default: 0.8,
  },
  ease: {
    type: String,
    default: 'power3.out',
  },
  initialOpacity: {
    type: Number,
    default: 0,
  },
  animateOpacity: {
    type: Boolean,
    default: true,
  },
  scale: {
    type: Number,
    default: 1,
  },
  blur: {
    type: Number,
    default: 0,
  },
  rotate: {
    type: Number,
    default: 0,
  },
  tilt: {
    type: Number,
    default: 0,
  },
  wipe: {
    type: String,
    default: 'none',
  },
  threshold: {
    type: Number,
    default: 0.1,
  },
  delay: {
    type: Number,
    default: 0,
  },
  stagger: {
    type: Number,
    default: 0,
  },
  staggerFrom: {
    type: String,
    default: 'start',
  },
  trigger: {
    type: String,
    default: 'scroll',
  },
  once: {
    type: Boolean,
    default: true,
  },
  scrub: {
    type: [Boolean, Number],
    default: false,
  },
  disappearAfter: {
    type: Number,
    default: 0,
  },
  disappearDuration: {
    type: Number,
    default: 0.5,
  },
  disappearEase: {
    type: String,
    default: 'power3.in',
  },
  className: {
    type: String,
    default: '',
  },
  style: {
    type: [Object, String, Array],
    default: undefined,
  },
})
const emit = defineEmits(['start', 'complete', 'disappearanceComplete'])
const rootRef = useTemplateRef('rootRef')
let teardown = null
const build = () => {
  const el = rootRef.value
  if (!el) return null
  const {
    container,
    distance,
    direction,
    reverse,
    duration,
    ease,
    initialOpacity,
    animateOpacity,
    scale,
    blur,
    rotate,
    tilt,
    wipe,
    threshold,
    delay,
    stagger,
    staggerFrom,
    trigger,
    once,
    scrub,
    disappearAfter,
    disappearDuration,
    disappearEase,
  } = props
  el.style.visibility = 'hidden'
  let scroller = container || document.getElementById('snap-main-container') || null
  if (typeof scroller === 'string') scroller = document.querySelector(scroller)
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const ctx = gsap.context(() => {
    const targets = stagger > 0 && el.children.length ? Array.from(el.children) : [el]
    const horizontal = direction === 'horizontal'
    const axis = horizontal ? 'x' : 'y'
    const sign = reverse ? -1 : 1
    const mask = WIPES[wipe]
    gsap.set(el, { visibility: 'visible' })
    if (reduce) {
      emit('complete')
      return
    }
    const from = {
      [axis]: distance * sign,
      scale,
      opacity: animateOpacity ? initialOpacity : 1,
    }
    const to = {
      [axis]: 0,
      scale: 1,
      opacity: 1,
      duration,
      ease,
    }
    if (blur > 0) {
      from.filter = `blur(${blur}px)`
      to.filter = 'blur(0px)'
    }
    if (rotate) {
      from.rotation = rotate * sign
      to.rotation = 0
    }
    if (tilt) {
      const tiltAxis = horizontal ? 'rotationY' : 'rotationX'
      from[tiltAxis] = horizontal ? -tilt * sign : tilt * sign
      to[tiltAxis] = 0
      from.transformPerspective = 900
      to.transformPerspective = 900
    }
    if (mask) {
      gsap.set(targets, {
        maskImage: mask,
        webkitMaskImage: mask,
      })
      from['--ac-wipe'] = 0
      to['--ac-wipe'] = 1
    }
    if (stagger > 0)
      to.stagger = {
        each: stagger,
        from: staggerFrom,
      }
    const settle = () => {
      if (scrub) return
      gsap.set(targets, {
        clearProps: mask ? 'filter,transform,maskImage,webkitMaskImage' : 'filter,transform',
      })
    }
    const disappear = () => {
      if (disappearAfter <= 0) return
      const out = {
        [axis]: -distance * sign,
        scale: 0.8,
        opacity: animateOpacity ? initialOpacity : 0,
        delay: disappearAfter,
        duration: disappearDuration,
        ease: disappearEase,
        onComplete: () => emit('disappearanceComplete'),
      }
      if (blur > 0) out.filter = `blur(${blur}px)`
      if (stagger > 0)
        out.stagger = {
          each: stagger,
          from: staggerFrom,
        }
      gsap.to(targets, out)
    }
    const tl = gsap.timeline({
      paused: true,
      onStart: () => emit('start'),
      onComplete: () => {
        emit('complete')
        settle()
        if (once && !scrub) disappear()
      },
    })
    tl.fromTo(targets, from, to, scrub ? 0 : Math.max(delay, 0))
    if (trigger === 'mount') {
      tl.play()
      return
    }
    const start = `top ${(1 - threshold) * 100}%`
    if (scrub) {
      ScrollTrigger.create({
        trigger: el,
        scroller: scroller || undefined,
        start,
        end: `top ${Math.max((1 - threshold) * 100 - 45, 5)}%`,
        scrub: scrub === true ? true : Math.max(Number(scrub) || 0, 0.01),
        animation: tl,
      })
      return
    }
    ScrollTrigger.create({
      trigger: el,
      scroller: scroller || undefined,
      start,
      once,
      onEnter: () => tl.play(),
      onLeaveBack: once
        ? undefined
        : () => {
            if (mask)
              gsap.set(targets, {
                maskImage: mask,
                webkitMaskImage: mask,
              })
            tl.reverse()
          },
    })
  }, el)
  return () => ctx.revert()
}
const rebuild = () => {
  teardown?.()
  teardown = build()
}
onMounted(rebuild)
watch(
  [
    () => props.container,
    () => props.distance,
    () => props.direction,
    () => props.reverse,
    () => props.duration,
    () => props.ease,
    () => props.initialOpacity,
    () => props.animateOpacity,
    () => props.scale,
    () => props.blur,
    () => props.rotate,
    () => props.tilt,
    () => props.wipe,
    () => props.threshold,
    () => props.delay,
    () => props.stagger,
    () => props.staggerFrom,
    () => props.trigger,
    () => props.once,
    () => props.scrub,
    () => props.disappearAfter,
    () => props.disappearDuration,
    () => props.disappearEase,
  ],
  rebuild,
  { flush: 'post' },
)
onBeforeUnmount(() => {
  teardown?.()
  teardown = null
})
</script>

<template>
  <div ref="rootRef" :class="className" :style="style">
    <slot />
  </div>
</template>
