import Quill from 'quill';
import { imageWidth, DEFAULT_IMAGE_WIDTH } from './core.js';

// Persist relative width in Delta and HTML; never retain fixed pixel dimensions.
const BaseImage = Quill.import('formats/image');
class ResponsiveImage extends BaseImage {
  static create(value) {
    const node = super.create(value);
    node.setAttribute('width', DEFAULT_IMAGE_WIDTH);
    node.style.width = DEFAULT_IMAGE_WIDTH;
    return node;
  }
  static formats(node) {
    return { ...(node.hasAttribute('alt') ? { alt: node.getAttribute('alt') } : {}), width: imageWidth(node.getAttribute('width')) };
  }
  format(name, value) {
    if (name === 'width') {
      const width = imageWidth(value);
      this.domNode.setAttribute('width', width);
      this.domNode.style.width = width;
      this.domNode.removeAttribute('height');
    } else if (name !== 'height') super.format(name, value);
  }
}
Quill.register('formats/image', ResponsiveImage, true);
