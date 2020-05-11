class TranslatePkg {
  path: string;
  constructor(public enPath: string) {
    this.path = enPath.substring(0, enPath.length - 'en.yaml'.length);
  }

  async collectEn() {}

  async collectLan(locale: string) {}
}
