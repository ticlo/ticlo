(Element.prototype as any).toArrow = function () {
  let parts = ['͢:', this.tagName];
  if (this.id) {
    parts.push('#', this.id);
  }
  if (this.className) {
    parts.push('.', this.className);
  }
  return parts.join('');
};

// export empty object to make it a module
export {};
