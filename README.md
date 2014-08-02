AppDotNetAPI (AKA AltAPI)
============

An alternative implementation of App.net API implemented as an App.net client. This is an attempt to make the App.net API an open standard.

This is a piece of software that you can run to emulate the app.net API that all the existing app.net apps could connect to (if we can convince 3rd party app developers to include a configurable API/OAuth root in their app.net software).

This way we can keep the community and software intact.

Compatibility is goal #1.

#Upstream integration

It can work as a back up to the main app.net. So while app.net is running everything could feel like one network.

A local AltAPI account can be linked with an App.net account. All locally created posts can be cross posted to app.net. All app.net created posts can be streaming into our data source and out to clients, ensuring seemless two way posting between the networks on a per user basis.

An API server operator can decide whether to allow non-linked app.net accounts to be able to post or not. If not allowed, there would be a complete two-way App.net relay and backup; this is because an app.net account posting to that AltAPI would be linked to a local AltAPI account, which means that the data would propagate through the AltAPI network and be preserved. Otherwise, if non-linked app.net accounts are allowed to post then the server operator will end up with content only available on their node.

This client/server relationship actually allows an API server whether it's app.net or other API compliant servers to link up in a hub-spoke topology and distribute the network across additional resources. Though work and planning will need to be put into distributed authentication and authorize.

Users would authorize AltAPI with their app.net accounts, just like they would any other app.net app. We envision users, after authorizing AltAPI, being able to choose between AltAPI nodes to use.

The authorization flow itself would happen via OAuth proxy. This means that OAuth requests propagate up nodes until reaching the top node (usually app.net; otherwise the next connected AltAPI node would take its place). At each successive node, a token is returned, then the request continues upstream. When the subsequent node returns a token, that remote upstream token is mapped to the token that the requesting node returned--the local token.

As well as you can set up your own standalone social network and embrace all the app.net clients that support setting an alternative API root.

#Components

## Daemons
We'd need a web daemon for serving web requests.
Then a background daemon for upstream streaming (connects to app.net using an app streaming), maintenance or background processing.
And then a websocket daemon for user streaming.

The web and background daemon will be written in NodeJS as they'll need to share code for creating posts. 

The websocket daemon will be written in Go since it'll just be reading and no writing.


##OAuth and sign up
We will need to implement our own oauth server and sign up process. Since we don't want users using their real app.net username and password.

##Data flow

###Dialects (dialect.*.js)
The server will support different "dialects" of the API. The first one will be "appdotnet_official" which will be the 100% compatible implementation. These will create ExpressJS mountpoints in the NodeJS web server.

New dialects will be able to extend the app.net API without breaking existing clients. A server is able to run multiple dialects at once.

###Dispatcher (dispatcher.js)
This mainly translate internal API calls to DataAccess Chain. Dispatcher talks to the configured "cache". The upstream app stream and the DataAccess chain will feed data through the dispatcher for transformation and to be stored in the DataStore.

###DataAccess Chain (dataaccess.*.js)
The DataAccess chain is list of DataAccess objects. Each objects in the chain will have the same exact API. If a query is not in current DataAccess layer, it will send the request to the next DataAccess layer in the chain until the request is served. Writes can cascading up too incase there are mulitple upstream providers to post to each one individually.

####DataAccess: Cache
This is just a pass-through at the moment (dataaccess.base.js). Eventually hand crafted modules will be created. These modules will have more performant data structures than the data store can provide and can be used to optimize slower API paths.

####DataAccess: Data store
This contains the models for the caminte ORM (dataaccess.caminte.js) and the API to get and set data in the Data store. 

This will be segmented in to 4 backing stores: Auth, Token, Rate limiting, and Data. You will be able to configure each backing store to use a different storage backend (memory, SQLite, Redis, MySQL). 

This layer will be responsible for managing expiration and size of the data set. 

####DataAccess: Upstream Proxy
Reqeusts will be turned into requests that can be proxied from an upstream server. 

###Upstream streaming
If configured, the NodeJS web server will create an app token with an upstream network (app.net at the moment) and use app streaming to receive network updates and populate it's cache/data store through the dispatcher.

##Current Performance
I'm finding (with taking in account network latency) the performance of the NodeJS web server is 10-20 faster than the official app.net API (Using memory or Redis data stores). This is likely due to the small datasets I'm testing with. Only time will tell with the larger datasets to see if the performance will hold steady.

##Potential Scalability
Using Ohe's lightPoll model; I believe with a message queue, we can have multiple web worker nodes (only one master node with upstream connection). This will allow for additional scalability if you wish to do a large scale deployment or just to use all the cpu cores in one server.

#I'm an app.net 3rd party developer how can I get my app ready for an alternative API server?
We just need you to have the root of the API request to be configureable.

So if you have "`https://api.app.net/`" or "`https://alpha-api.app.net/stream/0/`" are your API root right now, you just need an UI for your users to be able to enter an alternate root. This will allows users to select what API to connect to and use.

We'll also need to allow your OAuth endpoints to be configureable. As the users will have different usernames and passwords than their app.net counter parts.

We're talking about implementing a JSON data source that will provide a directory of all the available AltAPI servers. This will be for the 3rd party app devs that really want a really nice UI for selecting an AltAPI server.

# Possible network configurations
##ADNFuture
We will be creating a new spoke from App.net. Other people that want to run servers can spoke off our hub implementation. This allows app.net to go down and for us to keep the network going. We may introduce a peer to peer mode under our hub to help distribute load as well.

App.net => ADNFuture => Multiple providers

##Local cache
You can run your own local cache to speed up your app.net network interactions:

ADNFuture => Your local cache

##Standalone
Start your own social network using this software as the main hub and base. You can allow or deny other spokes from connecting to your hub.

Your Hub => Possible spokes

# Requirements

* Node.js 0.8.xx+

# Installation

1. Copy config.sample.json to config.json

1. [optional] Create a new application on App.net. Note the client_id and client_secret and put in `config.json`. The redirect URI should be /return on the host you're going to use for AltAPI, e.g., <http://localhost:7070/return>.

1. `npm install` to get node js libraries

1. `node app.js` to run the server

1. Open your browser to <http://localhost:7070/>

# Security
It's best practice to not have clients directly connect to node.js. We recommend use stunnel or nginx to provide an HTTPS connection to ensure data is encrypted while it travels over the Internet.

#Roadmap

##Phase #0 - Public proxy - Complete 
This is an easy target to lay out the base foundation. We just need a webserver. We will just proxy app.net data.

+ posts
  + /posts/1
  + /users/1/posts
  + /users/1/stars
  + /posts/tag/jukebox
  + /posts/stream/global
+ channels/messages
  + /channels/1383
  + /channels/1383/messages
  + /channels/1383/messages/3442494
+ configuration
  + /config
+ text processor
  + /text/process
+ oEmbed
  + /oembed?url=https://posts.app.net/1

##Phase #1 - Public endpoints - In Progress
We have added a data store to the project at this point. We will  stream, store and relay app.net data. We're adding a lot of structure here. 

Same endpoints as Phase #0

###Phase #1.1 - Storage structure - Complete
###Phase #1.2 - Proxy uses DataAccess Chain - Complete
###Phase #1.3 - Parameters - In progress
####Paging paramters - In progress
#####Complete:
+ posts
  + /posts/stream/global

#####Incomplete:
- posts
  - /users/1/posts
  - /users/1/stars
  - /posts/tag/jukebox
- channels/messages
  - /channels/1383/messages
  
#####ids parameter endpoints
- posts
  - /posts?ids=
- channels/messages
  - /channels
  - /channels/messages

####channel_types parameter
#####include_* parameter
I don't think any app functionality is harmed by having too much data, so we skip the parameters that are on by default. We will initially always return annotations, stream_marker for now. I've prioritize the following include as I find them to be most harmful to applications:

- posts
  - include_muted
  - include_machine
- channel
  - include_read
  - include_recent_message
  - include_inactive
- messages
  - include_muted
  - include_machine

all other include_* parameters will come at a later date.

##Phase #2 - Authenticated endpoints
This will have a local user database. And then you can authorize official your official ADN account. That way no one has to expose any current password. Local users will be mapped on to remote users through the authorize process. 

We will need to implement our own OAuth server that follows the App.net process with appropriate scopes. 

We will start developing the write endpoints as well as:
- users
- files
- interactions
- stream marker
- tokens (app/user)
- mutes
- blocks

##Phase #3 - Streaming
I feel that not many important app.net clients embrace user or app streaming (outside push notifications). So we can delay this peice until phase #3.

- user streaming
- app streaming

##Phase #4 - API Compatiblitilty Completion
- Search / Place
- Explore stream
- local oEmbed processor
- WebIntents
- WebFinger
- RSS Feeds
- Password flow authentication
- identity delegation

##Phase #5 Beyond app.net
- what did you want to see in the API?
<https://github.com/neuroscr/AppDotNetAPI/wiki/Future-API-ideas>


Config Roadmap
======

######Standalone mode:
Disables any app.net connectivity. Serves it's only social network to any
app.net API supported client
1. Participate in the App.net social network
2. Standalone social network

######port settings
web server port

######api base root url
Where does this server live.

######Upstream client id & secret
if connecting upstream to app.net, you'll need to set this to allow user authorization and app streaming with the upstream network.
######Upstream user token
if receiving a post from spoke API and we need to send it to a parent network, we will have to force all these posts to be under a single user's token. Not ideal but better than nothing

######Rate limtis
Global, verified user, user. Read/Write.

######Anotation Storage limits
/config stuff

######MySQL & Redis connection information
What's enabled? Host, user, pass, etc

######Factual API key

######Allowed client IDs
Limit 3rd party client connectivity

######Additional Protocol Modules:
these would allow additional pushes of streams.

1. tent.io API
2. pond API
3. maidsafe.net API
4. Activity Streams
5. PuSH/RSS
6. Webfinger
7. Diaspora
8. pump.io
9. Ident.ca / StatusNet
10. App.net extensions (what new API features can we add?)
11. Twitter

Potential Issues
======
- Authentication -
Each user in each spoke needs to authenticate with the parent network. For a more p2p system, we really should look at tent.io, pond, or maidsafe.net to see how they handle auth. I'm sure UUIDs are used somewhere.

- Client Secrets & IDs -
To make a client compatible to the real App.net and our API, they will not likely change their client ID. This is not a big deal since apps like patter or vidcast have to expose these in their source that's publicly viewable but we should take care to make sure we don't expose anything unecessarily.

- Location services - 
While factual has an API, each instances would need their own license.
This maybe feature we cannot easily support
