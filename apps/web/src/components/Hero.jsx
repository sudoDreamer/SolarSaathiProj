import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ArrowDown } from 'lucide-react';
import {
  ActionLink,
  Appearance,
  Container,
  Heading,
  HStack,
  Paragraph,
  Stack,
  Text,
  Link,
} from '../ui.jsx';
export function useScrollProgress(ref, disabled) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (disabled) {
      setProgress(0.75);
      return;
    }
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const node = ref.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        setProgress(Math.max(0, Math.min(1, -rect.top / (rect.height - innerHeight))));
      });
    };
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('scroll', update);
      removeEventListener('resize', update);
    };
  }, [disabled]);
  return progress;
}
export function HeroSequence({ progress, reduced }) {
  const canvasRef = useRef(null),
    images = useRef([]),
    last = useRef(-1),
    totalFrames = useRef(1),
    progressRef = useRef(progress);
  const [poster, setPoster] = useState('/hero/hero-d-0001.webp'),
    [loaded, setLoaded] = useState(false);
  progressRef.current = progress;
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const response = await fetch('/hero/hero-manifest.json');
      const manifest = await response.json();
      const target = innerWidth < 768 ? manifest.mobile : manifest.desktop;
      setPoster(reduced ? manifest.dawnPoster : manifest.poster);
      if (reduced) return;
      images.current = [];
      // Low bandwidth devices get evenly spaced keyframes, not the whole film.
      const saveData = navigator.connection?.saveData;
      const paths = saveData
        ? target.frames.filter(
            (_, i) => i % Math.max(1, Math.floor(target.frames.length / 40)) === 0,
          )
        : target.frames;
      totalFrames.current = paths.length;
      for (let i = 0; i < paths.length && !cancelled; i++) {
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            if (!cancelled) {
              images.current[i] = img;
              draw();
              setLoaded(true);
            }
            resolve();
          };
          img.onerror = () => resolve();
          img.src = paths[i];
        });
      }
    }
    function draw() {
      const node = canvasRef.current,
        available = images.current;
      if (!node || !available.length) return;
      const rect = node.getBoundingClientRect(),
        scale = Math.min(devicePixelRatio || 1, 2);
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      if (
        node.width !== Math.round(rect.width * scale) ||
        node.height !== Math.round(rect.height * scale)
      ) {
        node.width = Math.round(rect.width * scale);
        node.height = Math.round(rect.height * scale);
        last.current = -1;
      }
      const index = Math.min(
        available.length - 1,
        Math.round(progressRef.current * (totalFrames.current - 1)),
      );
      if (last.current === index) return;
      const img = available[index];
      if (!img) return;
      const ctx = node.getContext('2d');
      if (!ctx) return;
      const ratio = Math.max(node.width / img.width, node.height / img.height);
      ctx.clearRect(0, 0, node.width, node.height);
      ctx.drawImage(
        img,
        (node.width - img.width * ratio) / 2,
        node.height - img.height * ratio,
        img.width * ratio,
        img.height * ratio,
      );
      last.current = index;
    }
    void init().catch(() => undefined);
    let frame = 0;
    const render = () => {
      draw();
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [reduced]);
  return (
    <div className="hero-scene" aria-hidden="true">
      <img src={poster} alt="" fetchPriority="high" />
      <canvas ref={canvasRef} style={{ opacity: loaded && !reduced ? 1 : 0 }} />
    </div>
  );
}
export function HeroWordmark({ progress }) {
  return (
    <Heading level={1} className="hero-wordmark" variant="display-xl">
      <span>Solar</span>Saathi
      <span className="wordmark-period" style={{ opacity: Math.min(1, 0.6 + progress) }}>
        .
      </span>
    </Heading>
  );
}
export function Hero({ reduced }) {
  const ref = useRef(null),
    progress = useScrollProgress(ref, reduced),
    { t } = useTranslation();
  return (
    <Appearance value="dark">
      <section
        className={`hero-scroll ${reduced ? 'hero-reduced' : ''}`}
        ref={ref}
        aria-label="A Maharashtra city changes from night to sunrise as you scroll"
      >
        <div className="hero-sticky">
          <HeroSequence progress={progress} reduced={reduced} />
          <div className="hero-vignette" />
          <Container className="hero-content">
            <Stack gap={6} align="start">
              <HStack gap={3}>
                <span className="eyebrow-line" />
                <Text variant="eyebrow">Made for Maharashtra. Powered by the sun.</Text>
              </HStack>
              <HeroWordmark progress={progress} />
              <Heading
                level={2}
                variant={{ initial: 'title-xl', md: 'display-sm' }}
                className="hero-message"
              >
                {progress < 0.4 ? (
                  <>
                    Every light in this city
                    <br />
                    is on a meter.
                  </>
                ) : (
                  <>
                    Your roof can work
                    <br />
                    for you.
                  </>
                )}
              </Heading>
              <Paragraph className="hero-description">
                {t('tagline')}
                <br />
                Find your solar size, subsidy and a clearer way forward.
              </Paragraph>
              <HStack gap={4} wrap="wrap">
                <ActionLink to="/calculate">
                  {t('check')} <ArrowUpRight size={18} aria-hidden="true" />
                </ActionLink>
                <Text variant="body-sm">Free. About 60 seconds. No login.</Text>
              </HStack>
            </Stack>
          </Container>
          <Container className="hero-baseline">
            <HStack justify="between" wrap="wrap" gap={4}>
              <Link to="/#solar-start" variant="plain" className="scroll-cue">
                <ArrowDown size={16} aria-hidden="true" /> Scroll to sunrise
              </Link>
              <Text variant="caption">
                18.5204° N · 73.8567° E &nbsp; / &nbsp; A brighter Maharashtra
              </Text>
            </HStack>
          </Container>
          <div className="hero-progress" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </section>
    </Appearance>
  );
}
