"use strict";

var Table      = require('cli-table2');
var lodash = require('lodash');
var schedule = require('node-schedule');
var geoip = require('geoip-lite');
var Gamedig = require('gamedig');
var BattleNode = require('battle-node');
var moment = require('moment');
var Helper = require('../z-bot-helper');

/**
 * Class that handles the RCON part of ZBOT.
 */
class ZBotBERcon
{
  /**
   * Constructor function. Gets called when class is made into a object.
   * @constructor
   * @param {JSON} data
   * @param {JSON} beRconData
   * @param {Client} bot
   * @param {ZBot} zbot
   * @param {null|GuildChannel} reloadChannel
   * @param {String} id
   */
  constructor(data, beRconData, bot, zbot, reloadChannel, id) {

    /**
     * Unique ID
     * @type {String}
     * @private
     */
    this._id = id;

    /**
     * @type {JSON}
     */
    this._cfg = beRconData;

    /**
     * @type {GuildChannel}
     */
    this._reloadChannel = reloadChannel;

    /**
     * @type {JSON}
     */
    this._data = data;

    /**
     * @type {ZBot}
     */
    this._zbot = zbot;

    /**
     * @type {null|BattleNode}
     * @private
     */
    this._bnode = null;
    /**
     * @type {Client}
     * @private
     */
    this._bot = bot;
    /**
     * @type {Guild}
     */
    this._guild = data.guild;

    /**
     * @type {null|GuildChannel}
     * @private
     */
    this._chatChannel = null; // deprecated

    /**
     * Channels
     * @type {{command: null, side: null, group: null, direct: null, admin: null, connect: null, vehicle: null, default: null, global: null}}
     * @private
     */
    this._channels = {
      'command': null,
      'side':  null,
      'group':  null,
      'direct':  null,
      'admin':  null,
      'connect':  null,
      'vehicle':  null,
      'default':  null,
      'global':  null
    };

    this._continue = false;
    this._cronJobs = [];

    this._loginAttempts = 0;
    this._reLoginAttempts = 0;

    this._timezone = 2;

    /**
     * @type Array<Object>
     */
    this._actions = lodash.values(this._cfg.actions).concat(lodash.values(this._data.config.specific.bercon.sharedActions));

    this.init();
  }


  get id() {
    return this._id;
  }

  set id(value) {
    this._id = value;
  }

  get zbot() {
    return this._zbot;
  }

  /**
   * Getter or the rcon configs
   * @returns {JSON|*}
   */
  get cfg() {
    return this._cfg;
  }

  /**
   * Getter or the bot
   * @returns {JSON|*}
   */
  get bot() {
    return this._bot;
  }


  /**
   * Gets the channels.
   * @returns {{command: null, side: null, group: null, direct: null, admin: null, connect: null, vehicle: null, default: null, global: null}|*}
   */
  get channels() {
    return this._channels;
  }

  /**
   *  Getter for the guild connected to this rcon instance.
   * @returns {Guild}
   */
  get guild() {
    return this._guild;
  }

  /**
   * Getter for the BattleNode instance.
   * @returns {null|BattleNode}
   */
  get bnode() {
    return this._bnode;
  }

  /**
   *
   * @param {null|BattleNode} bnode
   */
  set bnode(bnode) {
    this._bnode = bnode;
  }


  get continue() {
    return this._continue;
  }

  set continue(value) {
    this._continue = value;
  }

  get cronJobs() {
    return this._cronJobs;
  }

  set cronJobs(value) {
    this._cronJobs = value;
  }

  get loginAttempts() {
    return this._loginAttempts;
  }

  set loginAttempts(value) {
    this._loginAttempts = value;
  }

  get reLoginAttempts() {
    return this._reLoginAttempts;
  }

  set reLoginAttempts(value) {
    this._reLoginAttempts = value;
  }

  get timezone() {
    return this._timezone;
  }

  set timezone(value) {
    this._timezone = value;
  }

  get actions() {
    return this._actions;
  }

  set actions(value) {
    this._actions = value;
  }

  /**
   * Initiates the Node Rcon and tries to login
   */
  init() {

    if(this.cfg.hasOwnProperty('timezone')) {
      this._timezone = this.cfg.timezone;
    }

    this._bnode = new BattleNode(this.cfg);
    this.bindChannels();

    if(this._reloadChannel) {
      Helper.sendTextMessage(this._reloadChannel, this._actions.length + ' actions bound to rcon server.');
    } else {
      Helper.sendTextMessage(this._channels.command, this._actions.length + ' actions bound to rcon server.');
    }

    if(this._continue) {
      this.zbot.logBot('Login ' + this.guild.name + ' ('+this.guild.name+') : TextChannel -> ' + this.channels.default.name);
      this.initEvents();
      if(this._bnode) {
        this._bnode.login();
      }
    } else {
      Helper.sendTextMessage(this._reloadChannel, this.cfg.name + ' : ' +  'No default channel set or found. Mandatory!')
    }
  }

  reInit() {
    this._bnode = new BattleNode(this.cfg);
    this.zbot.logBot('Login ' + this.guild.name + ' ('+this.guild.name+') : TextChannel -> ' + this.channels.default.name);
    this.initEvents();
    if(this._bnode) {
      this._bnode.login();
    }
  }

    reUse() {
       // this.zbot.logBot('Reopen socket: Login ' + this.guild.name + ' ('+this.guild.name+') : TextChannel -> ' + this.channels.default.name);
       // if(this._bnode) {
       //     this._bnode.login();
      //  }
      this._zbot.reloadSpecificConfig(this.guild, this._channels.admin);
    }

  initCronJobs() {
    this.cancelCronJobs();
    let jobs = [];
    if(this._cfg.jobs) {
      this.cfg.jobs.forEach((job) => {
        // { 'time': ' ********* ', 'text': 'test' }
        if (job.time) {
          if (job.text) {
            let cronjob = schedule.scheduleJob(job.time, () => {
              if (job.text) {
                this.cmdSayGlobalMessage(job.text);
              }
            });
            jobs.push(cronjob);
          }
        }
      });
      Helper.sendTextMessage(this.channels.default, jobs.length + ' Cron Jobs initiated.');
    } else {
      Helper.sendTextMessage(this.channels.default, 'No cron jobs found.');
    }
    this.cronJobs = jobs;

  }

  /**
   * Cancel current running jobs.
   */
  cancelCronJobs() {
    this.cronJobs.forEach((job) => {
      if (!(job === null || job === undefined)) {
        job.cancel();
      }
    });
    this.cronJobs = [];
  }

  /**
   * Binds this bercon server it's channels
   */
  bindChannels() {
    this.channels.command = this._guild.channels.find(val => val.name === this.cfg.channels.commands);
    this.channels.side = this._guild.channels.find(val => val.name === this.cfg.channels.side);
    this.channels.group = this._guild.channels.find(val => val.name === this.cfg.channels.group);
    this.channels.direct = this._guild.channels.find(val => val.name === this.cfg.channels.direct);
    this.channels.admin = this._guild.channels.find(val => val.name === this.cfg.channels.admin);
    this.channels.connect = this._guild.channels.find(val => val.name === this.cfg.channels.joins);
    this.channels.vehicle = this._guild.channels.find(val => val.name === this.cfg.channels.vehicle);
    this.channels.default = this._guild.channels.find(val => val.name === this.cfg.channels.default);
    this.channels.global = this._guild.channels.find(val => val.name === this.cfg.channels.global);
   // this.channels.log = this._guild.channels.find(val => val.name === this.cfg.channels.log);

    let backupChannel = this._reloadChannel;

    let prefix = this._cfg.name + ' : ';

    if(this.channels.default) {
      if(this.channels.default.type === 'text') {
        this._continue = true;
        backupChannel = this._reloadChannel;
      }
    } else {
      this._defaultChannel = this._reloadChannel;
    }

    if(this.channels.command) {
      Helper.sendTextMessage(this.channels.command, prefix + 'Command channel bound.')
    } else {
      Helper.sendTextMessage(backupChannel, prefix + 'Command channel NOT bound. Please check the naming.')
    }

    if(this.channels.side) {
      Helper.sendTextMessage(this.channels.side, prefix + 'Side channel successfully bound.')
    } else {
      Helper.sendTextMessage(backupChannel, prefix + 'Side channel NOT bound. Please check the naming.')
    }

    if(this.channels.group) {
      Helper.sendTextMessage(this.channels.group, prefix + 'Group channel successfully bound.')
    } else {
      Helper.sendTextMessage(backupChannel, prefix + 'Group channel NOT bound. Please check the naming.')
    }

    if(this.channels.direct) {
      Helper.sendTextMessage(this.channels.direct, prefix + 'Direct channel successfully bound.')
    } else {
      Helper.sendTextMessage(backupChannel,prefix +  'Direct channel NOT bound. Please check the naming.')
    }

    if(this.channels.admin) {
      Helper.sendTextMessage(this.channels.admin, prefix + 'Admin channel successfully bound.')
    } else {
      Helper.sendTextMessage(backupChannel, prefix + 'Admin channel NOT bound. Please check the naming.')
    }

    if(this.channels.connect) {
      Helper.sendTextMessage(this.channels.connect, prefix + 'Connect channel successfully bound.')
    } else {
      Helper.sendTextMessage(backupChannel,prefix +  'Command channel NOT bound. Please check the naming.')
    }

    if(this.channels.vehicle) {
      Helper.sendTextMessage(this.channels.vehicle, prefix + 'Vehicle channel successfully bound.')
    } else {
      Helper.sendTextMessage(backupChannel, prefix + 'Vehicle channel NOT bound. Please check the naming.')
    }

    if(this.channels.global) {
      Helper.sendTextMessage(this.channels.global, prefix + 'Global channel successfully bound.')
    } else {
      Helper.sendTextMessage(backupChannel, prefix + 'Global channel NOT bound. Please check the naming.')
    }
  }

  /**
   * Delete the binded events on the bnode
   */
  deleteEvents() {
    let parent = this;
    this._bnode.removeListener('login', parent.loginListener);
    this._bnode.removeListener('message', parent.messageListener);
    this._bnode.removeListener('disconnected', parent.disconnectedListener);
  }

  /**
   * Listener action for login event
   * @param err
   * @param success
   */
  loginListener(err, success) {
    this.loginAction(err, success);
  }

  /**
   * Listener action for message event
   * @param message
   */
  messageListener(message) {
    this.chatMessagesAction(message);
  }

  /**
   * Listener action for disconnected event
   * @param extra
   */
  disconnectedListener(extra) {
    this.cancelCronJobs();
    if(extra && extra === 'stop') {
      this._zbot.logBot('RCON stopped on purpose. ZBot reload for ' + this.guild.name + '(' + this.guild.id +')');
      Helper.sendTextMessage(this.channels.default, 'RCON server disconnected on purpose. ZBot reload');
    } else {
      this._zbot.logBot('RCON server disconnected. Trying to reconnect in ' + (this._data.config.rconReconnect / 1000 ) + ' sec for ' + this.guild.name + '(' + this.guild.id +')');
      Helper.sendTextMessage(this.channels.default, 'RCON server disconnected. Trying to reconnect in ' + (this._data.config.rconReconnect / 1000 ) + ' sec.');
      let wait = new Promise((resolve, reject) => {
        setTimeout(resolve, this._data.config.rconReconnect)
      }).then(() => {
        this._zbot.logBot('Creating new rcon for ' + this.guild.name);
        if(this._bnode) {
          delete this._bnode;
        }
        this.reInit();
      });
    }
  }

  /**
   * Initiate Node RCON events and binds them to actions.
   */
  initEvents() {
    this._bnode.on('login', this.loginListener.bind(this));
    this._bnode.on('message', this.messageListener.bind(this));
    this._bnode.on('disconnected', this.disconnectedListener.bind(this));
  }

  /**
   * Action performed after login attempt.
   * @param {*} err
   * @param {boolean} success
   */
  loginAction(err, success) {
    if (err) {
      this._zbot.logBot('Unable to connect to server for ' + this.guild.name + '(' + this.guild.id + ')');
      Helper.sendTextMessage(this.channels.default, this._cfg.name + ': Unable to connect to server. Trying to reconnect in ' + (this._data.config.rconReconnect / 1000 ) + ' sec.');
      this._zbot.logBot('LoginAttempts ' + this._loginAttempts);
      if(this._loginAttempts < this._data.config.loginAttempts) {
        let wait = new Promise((resolve, reject) => {
          setTimeout(resolve, this._data.config.rconReconnect)
        }).then(() => {
          this._loginAttempts += 1;

          if(this._bnode) {
            delete this._bnode;
          }

          this.reInit();

        });
      } else {
        Helper.sendTextMessage( this.channels.default, this._cfg.name + ': Failed ' + this._loginAttempts + ' times to connect to the gameserver, please check if the server is online. @admin @administrator @rcon-admin');
        this._zbot.logBot('Failed ' + this._loginAttempts + ' times to connect to the gameserver of ' + this.guild.name );
      }
    } else {
      if (success === true) {
        this._zbot.logBot('Logged in RCON successfully for ' + this.guild.name + '('+ this.guild.id+')');
        Helper.sendTextMessage(this.channels.default, this._cfg.name + ': Logged in RCON successfully');
        this._loginAttempts = 0;
        this.initCronJobs();
      }
      else if (success === false) {
        this._zbot.logBot('RCON login failed! (password may be incorrect) for ' + this._guild.name + ' ('+ this.guild.id +')');
        Helper.sendTextMessage( this.channels.default, this._cfg.name + ': RCON login failed! Check your authentications and zbot reload.');
      }
    }
  }

  /**
   * Action called when a chatmessage is published.
   * @param {string} message
   */
  chatMessagesAction(message) {
    let channel = this.channels.default;

    let styledMessage = moment.utc().add(this._timezone,'h').format('DD/MM/YYYY, HH:mm:SS') + ' : ' + message;

    let disableShow = false;

    let isChat = true;

    console.log(message);

    switch (true) {
      case (message.startsWith('(Side)')):
        styledMessage = '```markdown\n# ' + styledMessage + '\n```';
        channel = this.channels.side;
        if(!this.cfg.showChannels.side) {
          disableShow = true;
        }
        break;
      case (message.startsWith('(Group)')):
        styledMessage = '```css\n' + styledMessage + '\n```';
        channel = this.channels.group;
        if(!this.cfg.showChannels.group) {
          disableShow = true;
        }
        break;
      case (message.startsWith('(Direct)')):
        styledMessage = '```py\n# ' + styledMessage + '\n```';
        channel = this.channels.direct;
        if(!this.cfg.showChannels.direct) {
          disableShow = true;
        }
        break;
      case (message.startsWith('(Vehicle)')):
        styledMessage = '```fix\n' + styledMessage + '\n```';
        channel = this.channels.vehicle;
        if(!this.cfg.showChannels.vehicle) {
          disableShow = true;
        }
        break;
      case (message.startsWith('(Global)')):
        styledMessage = '```cs\n" ' + styledMessage + ' "\n```';
        channel = this.channels.global;
        if(!this.cfg.showChannels.global) {
          disableShow = true;
        }
        break;
      case (message.startsWith('RCon admin') ):
        styledMessage = '```py\n@ ' + styledMessage + '\n```';
        channel = this.channels.admin;
        isChat = false;
        if(!this.cfg.showChannels.admin) {
          disableShow = true;
        }
        break;
      case (message.startsWith('Player #') || message.startsWith('Verified GUID') ):
        styledMessage = '```py\n@ ' + styledMessage + '\n```';
        channel = this.channels.connect;
        isChat = false;
        if(!this.cfg.showChannels.joins) {
          disableShow = true;
        }
        break;
      default:
        isChat = false;
        styledMessage = '```\n' + styledMessage + '\n```';
    }

    if(!disableShow) {
      if (channel) {
        Helper.sendTextMessage(channel, styledMessage);
      } else {
        Helper.sendTextMessage(this.channels.default, 'The specific channel does not exist. Posting in default. Please check your channel config.');
        Helper.sendTextMessage(this.channels.default, styledMessage);
      }
    }

    if(isChat) {
      this.checkMessageForCommand(message, channel, styledMessage);
    }
  }

  /**
   * Checks for commands in the chat message.
   * @param {string} message
   * @param {Channel} channel
   * @param {string} styledMessage
   */
  checkMessageForCommand(message, channel, styledMessage) {
    if(!(message.startsWith('RCon admin'))) {

      let chat = message.split(':');

      if(chat.length > 2) {
        message = chat[2];
      }

      this._actions.forEach((action) => {
        if (action.command) {
          if (message.includes(action.command)) {
            if (action.reply) {
              this.cmdSayGlobalMessage(action.reply);
            }
            if (action.discordReply) {
              Helper.sendTextMessage(this.channels.admin, styledMessage);

              let discordMessage = action.discordReply;

              if (action.role) {
                let role = this._guild.roles.find(val => val.name ===  action.role);
                if (role) {
                  role.members.array().forEach((member) => {
                    discordMessage += ` ${member.toString()}`;
                  });
                }
              }

              Helper.sendTextMessage(this.channels.admin, discordMessage);
            }
          }
        }
      });
    }
  }

  /**
   * Checks if user has the correct role to use the command
   * @param {Channel} message
   * @param {string} command
   * @returns {boolean}
   */
  hasCorrectRole(message, command) {
    let role = this._data.config.specific.bercon.permissions[command];
    if(role) {
      let answer = message.member.roles.exists('name', role);
      if(!answer) {
        Helper.sendTextMessage(message.channel, 'You need the following role to use this command: ' + role);
      }
      return answer
    }
    Helper.sendTextMessage( message.channel, 'Something is wrong with the configs. Maybe a new command? Check if this command has a role on the webpanel. Otherwise :/ contact Zupa');
    return false;
  }

  /**
   * Checks for commands by admin in discord
   *  * @param {Message} message
   */
  checkAdminCommand(message) {
    //TODO read commands from discord admins

    if (message.guild.id !== this.guild.id) {
      return false;
    }

    if(!message.content.includes('!rcon')) {
      return false;
    }

    if (message.channel.id === this.channels.command.id) {

      switch (true)
      {
        case (message.content.includes('!rcon teststeam ')):
          // if(!this.hasCorrectRole(message, 'steam')) {
          //   break;
          // }
          this.cmdSteamTestPrintData(message.content.toString().replace("!rcon teststeam ", ""));
          break;
        case (message.content.includes('!rcon steam')):
          if(!this.hasCorrectRole(message, 'steam')) {
            break;
          }
          this.cmdSteamPrintData();
          break;
        case (message.content.includes('!rcon players+')):
          if(!this.hasCorrectRole(message, 'players')) {
            break;
          }
          this.cmdPrintAllExtendedPlayers();
          break;
        case (message.content.includes('!rcon players')):
          if(!this.hasCorrectRole(message, 'players')) {
            break;
          }
          this.cmdPrintAllPlayers();
          break;
        case (message.content.includes('!rcon admins')):
          if(!this.hasCorrectRole(message, 'admins')) {

            break;
          }
          this.cmdPrintAllAdmins();
          break;
        case (message.content.includes('!rcon bans')):
          if(!this.hasCorrectRole(message, 'bans')) {

            break;
          }
          this.cmdPrintAllBans();
          break;
        case (message.content.includes('!rcon load scripts')):
          if(!this.hasCorrectRole(message, 'loadScripts')) {

            break;
          }
          this.cmdReloadScripts();
          break;
        case (message.content.includes('!rcon load events')):
          if(!this.hasCorrectRole(message, 'loadEvents')) {

            break;
          }
          this.cmdReloadEvents();
          break;
        case (message.content.includes('!rcon say all ')):
          if(!this.hasCorrectRole(message, 'say')) {

            break;
          }
          this.cmdSayGlobalMessage(message.content.toString().replace("!rcon say all ", ""));
          break;
        case (message.content.includes('!rcon say ')):
          if(!this.hasCorrectRole(message, 'say')) {

            break;
          }
          this.cmdSayPlayerMessage(message.content.toString().replace("!rcon say ", ""));
          break;
        case (message.content.includes('!rcon missions')):
          if(!this.hasCorrectRole(message, 'missions')) {

            break;
          }
          this.cmdGetMissions();
          break;
        case (message.content.includes('!rcon version')):
          if(!this.hasCorrectRole(message, 'version')) {

            break;
          }
          this.cmdGetVersion();
          break;
        case (message.content.includes('!rcon update')):
          if(!this.hasCorrectRole(message, 'update')) {

            break;
          }
          this.cmdGetUpdate();
          break;
        case (message.content.includes('!rcon loadBans')):
          if(!this.hasCorrectRole(message, 'loadBans')) {

            break;
          }
          this.cmdLoadBans();
          break;
        case (message.content.includes('!rcon writeBans')):
          if(!this.hasCorrectRole(message, 'writeBans')) {

            break;
          }
          this.cmdWriteBans();
          break;
        case (message.content.includes('!rcon removeBan ')):
          if(!this.hasCorrectRole(message, 'removeBan')) {

            break;
          }
          this.cmdRemoveBan(message.content.toString().replace("!rcon removeBan ", ""));
          break;
        case (message.content.includes('!rcon ban ')):
          if(!this.hasCorrectRole(message, 'ban')) {

            break;
          }
          this.cmdBan(message.content.toString().replace("!rcon ban ", ""));
          break;
        case (message.content.includes('!rcon addBan ')):
          if(!this.hasCorrectRole(message, 'addBan')) {

            break;
          }
          this.cmdAddBan(message.content.toString().replace("!rcon addBan ", ""));
          break;
        case (message.content.includes('!rcon MaxPing ')):
          if(!this.hasCorrectRole(message, 'MaxPing')) {

            break;
          }
          this.cmdSetMaxPing(message.content.toString().replace("!rcon MaxPing ", ""));
          break;
        case (message.content.includes('!rcon kick ')):
          if(!this.hasCorrectRole(message, 'kick')) {

            break;
          }
          this.cmdKickPlayer(message.content.toString().replace("!rcon kick ", ""));
          break;
        case (message.content.includes('!rcon disconnect')):
          if(!this.hasCorrectRole(message, 'disconnect')) {

            break;
          }
          this.cmdDisconnect();
          break;
        case (message.content.includes('!rcon exit')):
          if(!this.hasCorrectRole(message, 'exit')) {

            break;
          }
          this.cmdExit();
          break;
        case (message.content.includes('!rcon #')):
          if(!this.hasCorrectRole(message, 'serverCommands')) {

            break;
          }
          this.cmdServerCommand(message.content.toString().replace("!rcon ", ""));
          break;
        case (message.content.includes('!rcon') ): // must be last case.
          this.listCommands();
          break;
      }

      return true;

    } else {
      return this.cfg.name + ': This is not the command channel for rcon.';
    }
  }

  /**
   *
   * @param {GuildChannel} oldChannel
   * @param {GuildChannel} newChannel
   */
  updateChannels(oldChannel, newChannel) {

    if( this._reloadChannel && oldChannel.id === this._reloadChannel.id ) {
      this._reloadChannel = newChannel;
    }

    lodash.forOwn(this.channels, (channel, key) => {
      if( channel.id === oldChannel.id ) {
        this.channels[key] = newChannel;
        Helper.sendTextMessage(newChannel, 'Updated channel: ' + key);
      }
    });

  }

  /**
   * List all available rcon commands;
   */
  listCommands() {

    let commands = [
      {
        command: 'steam',
        desc: 'get steam data from server'
      },
      {
        command: 'players',
        desc: 'List all players'
      },
      {
        command: 'players+',
        desc: 'List all players with country flag'
      },
      {
        command: 'admins',
        desc: 'List all admins'
      },
      {
        command: 'bans',
        desc: 'List all bans'
      },
      {
        command: 'load scripts',
        desc: 'Reloads al BE scripts'
      },
      {
        command: 'load events',
        desc: 'Reloads al BE events'
      },
      {
        command: 'say all [text]',
        desc: 'Sends text to all users'
      },
      {
        command: 'say [playerId] [text]',
        desc: 'Sends text to specific user id'
      },
      {
        command: 'MaxPing [ping]',
        desc: 'Sets the maxping of the serve.'
      },
      {
        command: 'kick [playerId] [reason]',
        desc: 'Kicks player (eg: kick 32 Language pls.)'
      },
      {
        command: 'ban [playerId] [minutes] [reason]',
        desc: 'Bans online player (eg: ban 11 0 Duping) 0 = forever'
      },
      {
        command: 'addBan [GUID|IP] [minutes] [reason]',
        desc: 'Bans on/off player (eg: addBan 127.0.0.1 0 Duping)'
      },
      {
        command: 'removeBan [banId]',
        desc: 'Remove bans (eg: ban 11 )'
      },
      {
        command: 'version',
        desc: 'Display the BattlEye version'
      },
      {
        command: 'update',
        desc: 'Check for a newer BattlEye version'
      },
      {
        command: 'loadBans',
        desc: 'Reload Bans from bans.txt'
      },
      {
        command: 'writeBans',
        desc: 'Rewrite Bans to bans.txt'
      },
      {
        command: 'disconnect',
        desc: 'Disconnects the rcon'
      },
      {
        command: 'exit',
        desc: 'Exits the whole rcon client'
      }
    ];

    let serverCommands = [
      {
        command: '#shutdown',
        desc: 'Shutdown the GAME server'
      },
      {
        command: '#lock',
        desc: 'Locks the GAME server'
      },
      {
        command: '#unlock',
        desc: 'Unlocks the GAME server'
      },
      {
        command: '#missions',
        desc: 'Stops current missions and goes to mission list'
      },
      {
        command: '#reassign',
        desc: 'Moves all players back into the lobby'
      },
      {
        command: '#userlist',
        desc: 'Displays the list of users on the server'
      },
      {
        command: '#kick [serverPlayerId]',
        desc: 'Kicks an online player'
      },
      {
        command: '#exec ban [serverPlayerId]',
        desc: 'Bans an online player'
      },
    ];

    const LINE_WIDTH = 175;

    // Command list
    let table = new Table({
      chars: {
        'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': '', 'bottom': '' ,
        'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': '', 'left': '' ,
        'left-mid': '' , 'mid': '' , 'mid-mid': '', 'right': '' , 'right-mid': '' ,
        'middle': ''
      },
      colWidths: [
        Math.round(0.15*LINE_WIDTH), // We round it because providing a decimal number would
        Math.round(0.65*LINE_WIDTH)  // break cli-table2
      ],
      wordWrap: true
    });

    for (let i in commands) {
      table.push([commands[i].command, commands[i].desc]);
    }

    // Command list
    let table2 = new Table({
      chars: {
        'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': '', 'bottom': '' ,
        'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': '', 'left': '' ,
        'left-mid': '' , 'mid': '' , 'mid-mid': '', 'right': '' , 'right-mid': '' ,
        'middle': ''
      },
      colWidths: [
        Math.round(0.15*LINE_WIDTH), // We round it because providing a decimal number would
        Math.round(0.65*LINE_WIDTH)  // break cli-table2
      ],
      wordWrap: true
    });

    for (let i in serverCommands) {
      table2.push([serverCommands[i].command, serverCommands[i].desc]);
    }

    let fullMessage = '# ZBot BattlEye RCON commands\n' +
      '\n' +
      '**All commands are prefixed with !rcon**\n' +
      '\n' +
      '## Commands\n\n' +
      table.toString() +
      '\n\n' +
      '**More commands added later**';

    let fullMessage2 =
      '## Server Commands\n\n' +
      '\n' +
      '**All commands are prefixed with !rcon**\n' +
      '\n' +
      table2.toString() +
      '\n\n' +
      '**More commands added later**';

    //this._commandChannel.sendMessage('```Markdown\n' + fullMessage + '```');
    Helper.printLongMarkupMessage(fullMessage, this.channels.command);
    Helper.sendTextMessage(this.channels.command,'```Markdown\n' + fullMessage2 + '```');
  }

  /**
   * Processes the player list to print a more extended player list.
   * @param {string} text
   * @param {channel} channel
   */
  processPlayerList(text, channel) {
    // First we split all the lines
    let lines = text.split(/\r?\n/);

    // temp player object array;
    let players = [];

    // Command list
    let table = new Table({
      chars: {
        'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': '', 'bottom': '' ,
        'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': '', 'left': '' ,
        'left-mid': '' , 'mid': '' , 'mid-mid': '', 'right': '' , 'right-mid': '' ,
        'middle': ''
      },
      colWidths: [
        Math.round(5), // id
        Math.round(10),  // flag
        Math.round(30), // Name
        Math.round(10), // ping
        Math.round(20), // IP
        Math.round(10), // port
        Math.round(100) // GUID
      ],
      wordWrap: true
    });


    let message = '| ID | Flag | Name | Ping | IP | Port | GUID |\n';
    message+= '|---|---|---|---|---|---|---|\n';


    //table.push(['ID', 'Flag', 'Name', 'Ping', 'IP', 'Port',  'GUID']);

    lines.splice(0,3); // Remove the first 3 lines..

    lines.forEach((line) => {
      if (!line.includes('players in total') && !line.includes('player in total') ) {
        let player = {
          id: '',
          flag: '',
          name: '',
          ping: '',
          ip: '',
          port: '',
          guid: '',

        };
         //0   78.118.153.156:2304   141  a79082b524def715d18dd3cd924dc1d9(OK) Gamer-Rafale
        let elements = line.split(" ");

        let index = 0;

        elements.forEach((el) => {
          if(el) {
              switch (index) {
                case 0:
                  player.id = el;
                  break;
                case 1:
                  let ipport = el.split(':');
                  player.ip = ipport[0];
                  player.port = ipport[1];
                  break;
                case 2:
                  player.ping = el;
                  break;
                case 3:
                  player.guid = el;
                  if(el == '-1') {
                    player.guid = 'Joining';
                  }
                  break;
                case 4:
                  player.name = el;
                  break;
                default:
                  player.name += ' ' + el;
              }
              index++;
          }
        });

        let geo = geoip.lookup(player.ip);

        if(geo) {
          player.flag = ':flag_' + geo.country.toLowerCase() + ':';
        }

        table.push([player.id, player.flag, player.name, player.ping, player.ip, player.port, player.guid]);

        message += '' + player.id + ' | ' + player.flag + ' | ' + player.name + ' | ' + player.ping + ' | ' + player.ip + ' | ' + player.port + ' | ' + player.guid + ' \n'


      }
    });

    //let message = table.toString();

    Helper.printLongMessage(message, channel);
  }

  /**
   * Executes a server command
   * @param {string} command
   */
  cmdServerCommand(command) {
    this._bnode.sendCommand(command, (message) => {
      if(message) {
        Helper.sendTextMessage(this.channels.command, message);
      }
    });
  }

  /**
   * Returns a list of the available missions on the server.
   */
  cmdGetMissions() {
    this._bnode.sendCommand('missions', (message) => {
      if(message) {
        Helper.sendTextMessage(this.channels.command, message);
      }
    });
  }

  /**
   * (Re)load the BE ban list from bans.txt in your BE working directory. This command is automatically issued on server launch.
   */
  cmdLoadBans() {
    this._bnode.sendCommand('loadBans', (message) => {
      if(message) {
        Helper.sendTextMessage(this.channels.command, message);
      }
    });
  }

  /**
   * Re-write the current ban list to bans.txt. This command can be used to remove expired bans.
   */
  cmdWriteBans() {
    this._bnode.sendCommand('writeBans', (message) => {
      if(message) {
        Helper.sendTextMessage(this.channels.command, message);;
      }
    });
  }

  /**
   * Returns the BattlEye version
   */
  cmdGetVersion() {
    this._bnode.sendCommand('version', (message) => {
      if(message) {
        Helper.sendTextMessage(this.channels.command, message);
      }
    });
  }

  /**
   * Returns if there is a BattlEye update
   */
  cmdGetUpdate() {
    this._bnode.sendCommand('update', (message) => {
      if(message) {
        Helper.sendTextMessage(this.channels.command, message);
      }
    });
  }

  /**
   * Kicks a player with a reason.
   * @param kickData
   */
  cmdKickPlayer(kickData) {
    this._bnode.sendCommand('kick ' + kickData, (message) => {
      if(message) {
        Helper.sendTextMessage(this.channels.command, message);
      }
    });
  }

  /**
   * Removes a specific ban.
   * @param {string} banId
   */
  cmdRemoveBan(banId) {
    this._bnode.sendCommand('removeBan ' + banId, (message) => {
      if(message) {
        Helper.sendTextMessage(this.channels.command, message);
      }
    });
  }

  /**
   * Bans an online player
   * @param {string} banData
   */
  cmdBan(banData) {
    this._bnode.sendCommand('ban ' + banData, (message) => {
      if(message) {
        Helper.sendTextMessage(this.channels.command, message);
      }
    });
  }

  /**
   * Bans an online or offline player
   * @param {string} banData
   */
  cmdAddBan(banData) {
    this._bnode.sendCommand('addBan ' + banData, (message) => {
      if(message) {
        Helper.sendTextMessage(this.channels.command, message);
      }
    });
  }

  /**
   * Sets max allowed ping
   * @param {string} ping
   */
  cmdSetMaxPing(ping) {
    this._bnode.sendCommand('MaxPing ' + ping, (message) => {
      if(message) {
        Helper.sendTextMessage(this.channels.command, message);
      }
    });
  }

  /**
   * Disconnects the rcon.
   */
  cmdDisconnect() {
    Helper.sendTextMessage(this.channels.command, 'Sending disconnect command.');
    if(this._bnode) {
    this._bnode.sendCommand('disconnect', (message) => {
      if(message) {
        Helper.sendTextMessage(this.channels.command, message);
      }
    });
    }
  }

  /**
   * Exits the rcon conection
   */
  cmdExit() {
    Helper.sendTextMessage(this.channels.command, 'Sending exit command.');
    if(this._bnode) {
    this._bnode.sendCommand('exit', (message) => {
      if(message) {
        Helper.sendTextMessage(this.channels.command, message);
      }
    });
    }
  }

  /**
   * Prints all players
   */
  cmdPrintAllPlayers() {
    this._bnode.sendCommand('players', (players) => {
      Helper.printLongMessage(players, this.channels.command);
    });
  }

  cmdPrintAllExtendedPlayers() {
    this._bnode.sendCommand('players', (players) => {
      this.processPlayerList(players, this.channels.command);
    });
  }

  /**
   * Prints all rcon & admins connected.
   */
  cmdPrintAllAdmins() {
    this._bnode.sendCommand('admins', (admins) => {
      Helper.printLongMessage(admins, this.channels.command);
    });
  }

  /**
   * Prints all bans.
   */
  cmdPrintAllBans() {
    this._bnode.sendCommand('bans', (bans) => {
      Helper.printLongMessage(bans, this.channels.command);
    });
  }

  /**
   * Sends a global message to all players online in the server
   * @param {string} text
   */
  cmdSayGlobalMessage(text) {
    this._bnode.sendCommand('say -1 ' + text);
  }

  /**
   * Sends a message to a single person, needs ID as first parameter
   * @param {string} text
   */
  cmdSayPlayerMessage(text) {
    this._bnode.sendCommand('say ' + text);
  }

  /**
   * (Re)load the client-side script scans/filters (explained below). This command is automatically issued on server launch.
   */
  cmdReloadScripts() {
    this._bnode.sendCommand('loadScripts');
  }

  /**
   * (Re)load the server-side event filters (explained below). This command is automatically issued on server launch.
   */
  cmdReloadEvents() {
    this._bnode.sendCommand('loadEvents');
  }

  /**
   * Gets data from steam.
   */
  cmdSteamPrintData() {
    Gamedig.query(
      {
        type: (this._cfg.game ? this._cfg.game : 'arma3'),
        host: (this._cfg.ip ? this._cfg.ip : '127.0.0.1'),
        port: (this._cfg.steamport ? this._cfg.steamport : '2303'),
      },
      function(state) {
        if(state.error) {
          console.log("Server is offline");
        } else {
          console.log(state);
        }
      }
    );
  }

  /**
   * Gets data with test parameters
   * @param {string} message
   */
  cmdSteamTestPrintData(message) {
    let data = message.split(':');

    console.log('testing arma3 ' + data[0] + ' : ' + data[1]);

    Gamedig.query(
      {
        type: 'arma3',
        host: data[0].trim(),
        port: parseInt(data[1].trim()),
        port_query: parseInt(data[2].trim()),
      },
      (state) => {
        if(state.error) {
          console.log("Server is offline");
          this._zbot.logBot(JSON.stringify(state, null, 2));
          console.log(state);
        } else {
          console.log(state);
          // this._zbot.logBot(JSON.stringify(state, null, 2));

          if(state.players) {
            state.players.forEach((player) => {

            });
          }
        }
      }
    );
  }
}

module.exports = ZBotBERcon;
