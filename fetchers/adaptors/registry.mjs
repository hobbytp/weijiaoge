
import { GenericAdaptor } from './generic.mjs';
import { GoogleBlogAdaptor } from './google-blog.mjs';

const adaptors = [
  GoogleBlogAdaptor
];

export function getAdaptor(url) {
  // Try specific adaptors first
  for (const Adaptor of adaptors) {
    if (Adaptor.match && Adaptor.match(url)) {
      return new Adaptor();
    }
  }

  // Fallback to Generic
  return new GenericAdaptor();
}
