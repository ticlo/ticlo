export const config = {
  capabilities: [
    {
      'browserName': 'chrome',
      'goog:chromeOptions': {
        args: ['--headless=new', '--disable-gpu'],
      },
      'webSocketUrl': true, // <—— 关键
    },
  ],
};
