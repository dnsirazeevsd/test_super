import type { ImageAsset } from '../lib/catalog';
import 'photoswipe/style.css';

interface Props {
  images: ImageAsset[];
  title: string;
}

export default function NewsGallery({ images, title }: Props) {
  const openAt = async (index: number) => {
    const { default: PhotoSwipe } = await import('photoswipe');
    const pswp = new PhotoSwipe({
      dataSource: images.map((img, i) => ({
        src: img.src,
        width: img.width,
        height: img.height,
        alt: `${title} — фото ${i + 1}`,
      })),
      index,
      bgOpacity: 0.92,
      wheelToZoom: true,
    });
    pswp.init();
  };

  if (images.length === 0) return null;

  return (
    <div
      class={`grid gap-4 ${
        images.length === 1 ? 'grid-cols-1 max-w-xl' : 'grid-cols-1 sm:grid-cols-2'
      }`}
    >
      {images.map((img, idx) => (
        <button
          key={img.key}
          type="button"
          onClick={() => openAt(idx)}
          class="group relative rounded-2xl overflow-hidden bg-bg-muted border border-line cursor-zoom-in text-left focus:outline-none"
          aria-label={`Открыть иллюстрацию ${idx + 1} к публикации «${title}»`}
        >
          <picture class="block w-full">
            <source
              type="image/avif"
              srcset={img.avifSrcset}
              sizes="(max-width: 640px) 92vw, 480px"
            />
            <source
              type="image/webp"
              srcset={img.webpSrcset}
              sizes="(max-width: 640px) 92vw, 480px"
            />
            <img
              src={img.src}
              alt={`${title} — изображение ${idx + 1}`}
              width={img.width}
              height={img.height}
              loading={idx === 0 ? 'eager' : 'lazy'}
              class="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform"
            />
          </picture>
        </button>
      ))}
    </div>
  );
}
