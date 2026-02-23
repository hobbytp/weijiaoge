
import { GenericAdaptor } from './generic.mjs';

const adaptors = [
  // Add specific adaptors here, e.g. RedditAdaptor
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
