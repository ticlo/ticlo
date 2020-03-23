(Element.prototype as any).toJsonEsc = function () {
  let parts = ['\u001b:', this.tagName];
  if (this.id) {
    parts.push('#', this.id);
  }
  if (this.className) {
    parts.push('.', this.className);
  }
  return parts.join('');
};
