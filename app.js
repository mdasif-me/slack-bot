require('dotenv').config();
const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true
});

receiver.router.use(express.json());
receiver.router.use(express.urlencoded({ extended: true }));

receiver.router.post('/api/send-message', async (req, res) => {
  try {
    const body = req.body || {};
    const channel = body.channel || req.query.channel;
    const message = body.message || req.query.message;
    const threadTs = body.thread_ts || body.thread_timestamp;
    const blocks = body.blocks;
    const attachments = body.attachments;
    
    if (!channel || !message) {
      return res.status(400).json({ 
        error: 'channel and message required',
        required_fields: { channel: 'string', message: 'string' },
        optional_fields: { thread_ts: 'string', blocks: 'array', attachments: 'array' }
      });
    }

    const messagePayload = {
      channel: channel.replace('#', ''),
      text: message
    };
    
    if (threadTs) messagePayload.thread_ts = threadTs;
    if (blocks && Array.isArray(blocks)) messagePayload.blocks = blocks;
    if (attachments && Array.isArray(attachments)) messagePayload.attachments = attachments;

    const result = await app.client.chat.postMessage(messagePayload);

    res.status(200).json({ 
      success: true, 
      message: `Sent to ${channel}`,
      timestamp: result.ts,
      channel: result.channel,
      thread_ts: result.thread_ts
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to send message to Slack'
    });
  }
});

receiver.router.post('/api/get-messages', async (req, res) => {
  const body = req.body || {};
  let channel = body.channel || req.query.channel;
  let limit = parseInt(body.limit || req.query.limit || 10);
  let cursor = body.cursor || req.query.cursor;
  let channelId; // Declare here so it's accessible in catch block

  try {
    if (!channel) {
      return res.status(400).json({ 
        error: 'channel required',
        required_fields: { channel: 'string' },
        optional_fields: { limit: 'number (default: 10, max: 100)', cursor: 'string (for pagination)' }
      });
    }

    channelId = channel.replace('#', '');
    
    if (!channelId.match(/^[CGDU]/)) {
      try {
        console.log(`Looking up channel ID for name: ${channelId}`);
        
        const publicChannels = await app.client.conversations.list({
          types: 'public_channel',
          limit: 200
        });
        
        let foundChannel = publicChannels.channels.find(ch => 
          ch.name === channelId
        );
        
        if (!foundChannel) {
          const privateChannels = await app.client.conversations.list({
            types: 'private_channel',
            limit: 200
          });
          
          foundChannel = privateChannels.channels.find(ch => 
            ch.name === channelId
          );
        }
        
        if (!foundChannel) {
          try {
            const channelInfo = await app.client.conversations.info({
              channel: channelId
            });
            channelId = channelInfo.channel.id;
          } catch (infoError) {
            return res.status(404).json({
              error: `Channel '${channelId}' not found`,
              details: 'Use channel ID instead of name',
              hint: 'Try using C1234567890 format instead of "general"',
              solution: 'Use /api/list-channels endpoint to get channel IDs'
            });
          }
        } else {
          channelId = foundChannel.id;
        }
        
      } catch (lookupError) {
        console.error('Channel lookup error:', lookupError);
        return res.status(500).json({
          error: 'Failed to lookup channel',
          details: lookupError.message
        });
      }
    }

    try {
      console.log(`Attempting to join channel: ${channelId}`);
      const joinResult = await app.client.conversations.join({
        channel: channelId
      });
      console.log(`Successfully joined channel: ${channelId}`, joinResult);
    } catch (joinError) {
      console.error(`Failed to join channel ${channelId}:`, joinError.message, joinError.data);
      // Check if it's a missing_scope error
      if (joinError.data?.error === 'missing_scope') {
        return res.status(403).json({ 
          error: 'Bot missing required scope',
          needed_scope: joinError.data?.needed,
          details: 'Add "channels:join" scope to your bot app',
          steps: [
            '1. Go to https://api.slack.com/apps',
            '2. Select your app',
            '3. Go to OAuth & Permissions > Scopes',
            '4. Add "channels:join" to Bot Token Scopes',
            '5. Reinstall/update the bot token',
            '6. Retry the request'
          ]
        });
      }
      // Only throw if it's a real permission error
      if (joinError.data?.error === 'not_in_channel' || joinError.data?.error === 'channel_not_found') {
        throw joinError;
      }
      // Continue if it's "already_in_channel" or other recoverable errors
    }

    const queryParams = {
      channel: channelId,
      limit: Math.min(limit, 100)
    };
    
    if (cursor) queryParams.cursor = cursor;

    console.log(`Fetching messages from channel ID: ${channelId}`);
    
    const result = await app.client.conversations.history(queryParams);
    
    const formattedMessages = (result.messages || []).map(msg => ({
      timestamp: msg.ts,
      user: msg.user || 'bot',
      username: msg.username,
      text: msg.text,
      type: msg.type,
      thread_ts: msg.thread_ts,
      is_thread_parent: msg.reply_count ? true : false,
      reply_count: msg.reply_count || 0,
      reactions: msg.reactions || []
    }));

    res.status(200).json({ 
      success: true, 
      channel: channel,
      channel_id: channelId,
      message_count: formattedMessages.length,
      messages: formattedMessages,
      has_more: result.has_more || false,
      next_cursor: result.response_metadata?.next_cursor
    });
  } catch (error) {
    console.error('Get messages error:', error);
    
    // Provide specific error messages
    if (error.data && error.data.error === 'not_in_channel') {
      return res.status(403).json({ 
        error: 'Bot is not a member of this channel',
        details: 'Add the bot to the channel first. Go to Slack > channel > Add members > search for your bot app',
        solution: `Invite the bot to #${channel} using Slack UI, then try again`,
        channel_id: channelId
      });
    }
    
    if (error.data && error.data.error === 'channel_not_found') {
      return res.status(404).json({ 
        error: 'Channel not found',
        details: 'Use channel ID instead of name',
        hint: 'Try /api/list-channels to get all available channels with their IDs'
      });
    }
    
    res.status(500).json({ 
      error: error.message,
      error_type: error.data?.error,
      details: 'Failed to retrieve messages from Slack'
    });
  }
});

receiver.router.get('/api/list-channels', async (req, res) => {
  try {
    const result = await app.client.conversations.list({
      types: 'public_channel,private_channel',
      limit: 200,
      exclude_archived: true
    });
    
    const channels = result.channels.map(ch => ({
      id: ch.id,
      name: ch.name,
      is_member: ch.is_member,
      is_private: ch.is_private,
      num_members: ch.num_members
    }));
    
    res.status(200).json({
      success: true,
      channel_count: channels.length,
      channels: channels
    });
  } catch (error) {
    console.error('List channels error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to list channels'
    });
  }
});

receiver.router.get('/api/channel-info', async (req, res) => {
  try {
    const channel = req.query.channel;
    
    if (!channel) {
      return res.status(400).json({
        error: 'channel parameter required',
        example: '/api/channel-info?channel=general OR /api/channel-info?channel=C1234567890'
      });
    }
    
    try {
      const result = await app.client.conversations.info({
        channel: channel
      });
      
      res.status(200).json({
        success: true,
        channel: result.channel
      });
    } catch (infoError) {
      const allChannels = await app.client.conversations.list({
        types: 'public_channel,private_channel',
        limit: 200
      });
      
      const foundChannel = allChannels.channels.find(ch => 
        ch.name === channel || ch.id === channel
      );
      
      if (foundChannel) {
        res.status(200).json({
          success: true,
          channel: foundChannel
        });
      } else {
        res.status(404).json({
          error: 'Channel not found',
          searched_for: channel
        });
      }
    }
  } catch (error) {
    console.error('Channel info error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to get channel info'
    });
  }
});

receiver.router.post('/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    
    const text = body.text || body.payload?.text;
    const channel = body.channel || body.payload?.channel || process.env.SLACK_DEFAULT_CHANNEL || '#general';
    const username = body.username || body.payload?.username || 'webhook-bot';
    const iconUrl = body.icon_url || body.payload?.icon_url;
    const iconEmoji = body.icon_emoji || body.payload?.icon_emoji;
    const attachments = body.attachments || body.payload?.attachments;
    
    if (!text) {
      return res.status(400).json({ 
        error: 'Missing required field: text',
        required_fields: ['text'],
        optional_fields: ['channel', 'username', 'icon_url', 'icon_emoji', 'attachments']
      });
    }
    
    const messagePayload = {
      channel: channel.replace('#', ''),
      text: text,
      username: username
    };
    
    if (iconUrl) {
      messagePayload.icon_url = iconUrl;
    } else if (iconEmoji) {
      messagePayload.icon_emoji = iconEmoji;
    }
    
    if (attachments && Array.isArray(attachments)) {
      messagePayload.blocks = attachments;
    }
    
    const result = await app.client.chat.postMessage(messagePayload);
    
    res.status(200).json({ 
      success: true, 
      message: 'Message posted to Slack',
      channel: channel,
      ts: result.ts
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to post webhook message to Slack'
    });
  }
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver
});

// start the app
(async () => {
  await app.start(process.env.PORT || 5000);
  console.log('⚡️ Slack bot is running!');
  console.log(`🌐 Web interface: http://localhost:${process.env.PORT || 5000}`);
})();