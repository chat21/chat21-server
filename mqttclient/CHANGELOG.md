Chat21Client.js CHANGELOG

### v0.1.12
- "connect" event now replies with a callback only after full subscribing succeded!

### v0.1.11
- crossConversationDetail improved with xmlhttprequest + nodejs request support

### v0.1.10
- added archivedConversationDetail()
- added crossConversationDetail()
- refactored conversationDetail() impl to use crossConversationDetail()
    
### v0.1.9
- added /outgoing to write path
- modified options.log => options._log

### v0.1.8
- added saveInstance() for push notifications

### v0.1.7
- removed logs

### v0.1.6
- added removeOnMessageAddedHandler()
- added removeOnGroupUpdatedHandler()

### v0.1.5
- added groupSetMembers()
- renamed createGroup() in groupCreate()
- renamed leaveGroup() in groupLeave()
- renamed joinGroup() in groupJoin()
- renamed getGroup() in groupData()

### v0.1.4
- added basicMessageBuilder()
- added sendMessageRaw()
- added leaveGroup()