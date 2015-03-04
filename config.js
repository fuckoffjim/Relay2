module.exports = {
  masters: ['YoSamaBeenLadin'],
  baseServer: '',
  relayServers: [''],
  baseNick: 'relay',
  relayNick: 'soupkitchen',
  commandIdentifer: '!',
  
  /**
   * connection variables (for irc)
   */
  baseConnection: {
    port: 6667,
    channels: ['#base'],
    userName: 'based', // ident
    realName: 'based_relay',
    debug: true,
    secure: false,
    selfSigned: true,
    certExpired: true,
    floodProtection: true,
    floodProtectionDelay: 1000,
  },
  /**
   * relay connection
   */
  relayConnection: {
    port: 6667,
    channels: ['#relay'],
    userName: 'relay', // ident
    realName: 'relay',
    debug: true,
    secure: false,
    selfSigned: true,
    certExpired: true,
    floodProtection: true,
    floodProtectionDelay: 1000,
  }
};