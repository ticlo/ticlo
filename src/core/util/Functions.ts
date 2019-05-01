export function stopPropagation(e: {stopPropagation: Function}) {
  e.stopPropagation();
}

export function preventDefault(e: {preventDefault: Function}) {
  e.preventDefault();
}

export function voidFunction() {
  // void function
}