'use strict';

define(['app',
        'backbone.marionette',
        'bluebird',
        'models/message',
        'models/groupSpec',
        'models/idea',
        'models/ideaLink',
        'models/segment',
        'models/synthesis',
        'models/partners',
        'models/agents',
        'models/notificationSubscription',
        'jquery',
        'objects/storage',
        'utils/types',
        'utils/i18n',
        'models/roles',
        'models/discussion',
        'models/discussionSource'],
    function (Assembl, Marionette, Promise, Message, groupSpec, Idea, IdeaLink, Segment, Synthesis, Partners, Agents, NotificationSubscription, $, Storage, Types, i18n, LocalRole, Discussion, DiscussionSource) {

        /**
         * @class CollectionManager
         *
         * A singleton to manage lazy loading of server collections
         */
        var CollectionManager = Marionette.Controller.extend({
            FETCH_WORKERS_LIFETIME: 30,

            /**
             * Send debugging output to console.log to observe the activity of lazy
             * loading
             * @type {boolean}
             */
            DEBUG_LAZY_LOADING: false,

            /**
             * Collection with all users in the discussion.
             * @type {UserCollection}
             */
            _allUsersCollection: undefined,

            _allUsersCollectionPromise: undefined,

            /**
             * Collection with all messsages in the discussion.
             * @type {MessageCollection}
             */
            _allMessageStructureCollection: undefined,

            _allMessageStructureCollectionPromise: undefined,

            /**
             * Collection with all synthesis in the discussion.
             * @type {SynthesisCollection}
             */
            _allSynthesisCollection: undefined,

            _allSynthesisCollectionPromise: undefined,

            /**
             * Collection with all ideas in the discussion.
             * @type {SegmentCollection}
             */
            _allIdeasCollection: undefined,

            _allIdeasCollectionPromise: undefined,

            /**
             * Collection with all idea links in the discussion.
             * @type {MessageCollection}
             */
            _allIdeaLinksCollection: undefined,

            _allIdeaLinksCollectionPromise: undefined,

            /**
             * Collection with all extracts in the discussion.
             * @type {SegmentCollection}
             */
            _allExtractsCollection: undefined,

            _allExtractsCollectionPromise: undefined,

            /**
             * Collectin with a definition of the user's view
             * @type {GroupSpec}
             */
            _allGroupSpecsCollection: undefined,

            _allGroupSpecsCollectionPromise: undefined,

            /**
             * Collection with all partner organization in the discussion.
             * @type {PartnerOrganizationCollection}
             */
            _allPartnerOrganizationCollection: undefined,
            _allPartnerOrganizationCollectionPromise: undefined,

            /**
             *  Collection from discussion notifications.
             * */
            _allNotificationsDiscussionCollection: undefined,
            _allNotificationsDiscussionCollectionPromise: undefined,


            /**
             *  Collection from user notifications
             * */
            _allNotificationsUserCollection: undefined,
            _allNotificationsUserCollectionPromise: undefined,


            /**
             *  Collection of user roles
             * */
            _allLocalRoleCollection: undefined,
            _allLocalRoleCollectionPromise: undefined,

            /**
             *  Collection from discussion
             * */
            _allDiscussionModel: undefined,
            _allDiscussionModelPromise: undefined,

            _allDiscussionSourceCollection: undefined,
            _allDiscussionSourceCollectionPromise: undefined,

            /**
             * Returns the collection from the giving object's @type .
             * Used by the socket to sync the collection.
             * @param {BaseModel} item
             * @param {String} [type=item['@type']] The model type
             * @return {BaseCollection}
             */
            getCollectionPromiseByType: function (item, type) {
                type = type || item['@type'];

                switch (type) {
                    case Types.EXTRACT:
                        return this.getAllExtractsCollectionPromise();

                    case Types.IDEA:
                    case Types.ROOT_IDEA:
                    case Types.PROPOSAL:
                    case Types.ISSUE:
                    case Types.CRITERION:
                    case Types.ARGUMENT:
                        return this.getAllIdeasCollectionPromise();

                    case Types.IDEA_LINK:
                        return this.getAllIdeaLinksCollectionPromise();

                    case Types.POST:
                    case Types.ASSEMBL_POST:
                    case Types.SYNTHESIS_POST:
                    case Types.IMPORTED_POST:
                    case Types.EMAIL:
                    case Types.IDEA_PROPOSAL_POST:
                    case Types.POST_WITH_METADATA:
                    case Types.FEED_POST:
                    case Types.LOOMIO_FEED_POST:
                        return this.getAllMessageStructureCollectionPromise();

                    case Types.USER:
                        return this.getAllUsersCollectionPromise();

                    case Types.SYNTHESIS:
                        return this.getAllSynthesisCollectionPromise();

                    case Types.PARTNER_ORGANIZATION:
                        return this.getAllPartnerOrganizationCollectionPromise();
                }

                return null;
            },

            /*getAllUsersCollectionPromise: function () {
                var that = this,
                    deferred = $.Deferred();

                if (this._allUsersCollectionPromise === undefined) {
                    this._allUsersCollection = new Agents.Collection();
                    this._allUsersCollection.collectionManager = this;
                    this._allUsersCollectionPromise = this._allUsersCollection.fetchFromScriptTag('users-json');
                    this._allUsersCollectionPromise.done(function () {
                        deferred.resolve(that._allUsersCollection);
                    });
                }
                else {
                    this._allUsersCollectionPromise.done(function () {
                        deferred.resolve(that._allUsersCollection);
                    });
                }
                return deferred.promise();
            },*/

            getAllUsersCollectionPromise: function () {
                if (this._allUsersCollectionPromise) {
                    return this._allUsersCollectionPromise;
                }

                this._allUsersCollection = new Agents.Collection();
                this._allUsersCollection.collectionManager = this;
                this._allUsersCollectionPromise = Promise.resolve(this._allUsersCollection.fetchFromScriptTag('users-json'))
                    .thenReturn(this._allUsersCollection)
                    .catch(function(e){
                       console.error(e.statusText);
                    });

                return this._allUsersCollectionPromise;
            },

            /*getAllMessageStructureCollectionPromise: function () {
                var that = this,
                    deferred = $.Deferred();

                if (this._allMessageStructureCollectionPromise === undefined) {
                    this._allMessageStructureCollection = new Message.Collection();
                    this._allMessageStructureCollection.collectionManager = this;
                    this._allMessageStructureCollectionPromise = this._allMessageStructureCollection.fetch({
                        success: function (collection, response, options) {
                            deferred.resolve(that._allMessageStructureCollection);
                        }
                    });
                }
                else {
                    this._allMessageStructureCollectionPromise.done(function () {
                        deferred.resolve(that._allMessageStructureCollection);
                    });
                }
                return deferred.promise();
            },*/

            getAllMessageStructureCollectionPromise: function () {
                if (this._allMessageStructureCollectionPromise) {
                    return this._allMessageStructureCollectionPromise;
                }
                this._allMessageStructureCollection = new Message.Collection();
                this._allMessageStructureCollection.collectionManager = this;
                this._allMessageStructureCollectionPromise = Promise.resolve(this._allMessageStructureCollection.fetch())
                    .thenReturn(this._allMessageStructureCollection)
                    .catch(function(e){
                        console.error(e.statusText);
                    });

                return this._allMessageStructureCollectionPromise;
            },

            _waitingWorker: undefined,

            _messageFullModelRequests: {},

            /*getMessageFullModelRequestWorker: function (collectionManager) {
                this.collectionManager = collectionManager,
                    this.requests = this.collectionManager._messageFullModelRequests,

                    this.addRequest = function (id, promise) {
                        if (this.requests[id] === undefined) {
                            this.requests[id] = {'promises': [],
                                'serverRequestInProgress': false}
                        }
                        this.requests[id]['promises'].push(promise);
                        if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                            console.log("Added request for id:" + id + ", queue size is now:" + _.size(this.requests));
                        }
                        // Each id can take up to ~40 characters.  To not exceed
                        // the 2048 characters unofficial limit for GET URLs,
                        // (IE and others), we only request up to do up to:
                        // 2000/40 ~= 50 id's at a time
                        var unservicedRequests = _.filter(this.requests, function(request){ return request['serverRequestInProgress'] === false; });
                        var numUnservicedRequests = _.size(unservicedRequests)
                        if (numUnservicedRequests >= 50) {
                            if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                                console.log("Executing unserviced request immediately, unserviced queue size is now:", numUnservicedRequests);
                            }
                            //TODO:  This is suboptimal, as the server can be hammered
                            //with concurrent requests for the same data, causing
                            //database contention.  Like a bit below, we should remember
                            //how many requests are in transit, and not have more than 3

                            //Alternatively, we could POST on a fake URL, with the url path
                            //as the body of the request and avoid this spliting completely.
                            this.executeRequest();
                        }
                    },

                    this.executeRequest = function () {
                        var that = this,
                            allMessageStructureCollectionPromise = this.collectionManager.getAllMessageStructureCollectionPromise(),
                            ids = [];
                        if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                            console.log("executeRequest fired, unregistering worker from collection Manager");
                        }

                        this.collectionManager._waitingWorker = undefined;
                        _.each(that.requests, function (request, id) {
                          //var structureModel = allMessageStructureCollection.get(id);
                          if (request['serverRequestInProgress'] === false) {
                              request['serverRequestInProgress'] = true;
                              ids.push(id);
                          }
                        });
                        allMessageStructureCollectionPromise.done(function (allMessageStructureCollection) {
                            var PostQuery = require('views/messageListPostQuery'),
                                postQuery = new PostQuery(),
                                viewDef = 'default';

                            if (_.size(ids) > 0) {
                                postQuery.addFilter(postQuery.availableFilters.POST_HAS_ID_IN, ids);
                                postQuery.setViewDef(viewDef); //We want the full messages
                                if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                                  console.log("requesting message data from server for "+ _.size(ids) + " messages");
                                }
                                postQuery.getResultRawDataPromise().done(function (results) {
                                    _.each(results, function (jsonData) {
                                        var id = jsonData['@id'],
                                            structureModel = allMessageStructureCollection.get(id),
                                            deferredList = that.requests[id];
                                        if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                                            console.log("executeRequest resolving for id", id, deferredList['promises'].length, "deferred queued for that id");
                                        }
                                        structureModel.set(jsonData);
                                        structureModel.viewDef = viewDef;
                                        if (deferredList !== undefined) {
                                            _.each(deferredList['promises'], function (deferred) {
                                                deferred.resolve(structureModel);
                                            });
                                            delete that.requests[id];
                                        }
                                        else {
                                            console.log("WARNING: collectionManager::executeRequest() received data for " + id + ", but there is no matching request.  Race condition?");
                                        }
                                    });
                                });
                            }
                            else {
                                if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                                    console.log("executeRequest called, but no ids to request from the server out of the list of ", _.size(that.requests));
                                }
                            }
                        });
                    }

                //Constructor
                if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                  console.log("Spawning new _getMessageFullModelsRequestWorker");
                }
                var that = this;
                this.executeTimeout = setTimeout(function () {
                  if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                    console.log("Executing unserviced request immediately (timeaout reached)");
                  }
                  that.executeRequest();
                }, collectionManager.FETCH_WORKERS_LIFETIME);
            },*/

            getMessageFullModelRequestWorker: function (collectionManager) {
              this.collectionManager = collectionManager,
              this.requests = this.collectionManager._messageFullModelRequests,

              this.addRequest = function (id) {
                /* Emulates the defered pattern in bluebird, in this case we really do need it */
                function Defer() {
                  var resolve, reject;
                  var promise = new Promise(function() {
                    resolve = arguments[0];
                    reject = arguments[1];
                  });
                  return {
                    resolve: resolve,
                    reject: reject,
                    promise: promise
                  };
                }
                var promiseResolver;
                if (this.requests[id] === undefined) {
                  promiseResolver = new Defer();
                  this.requests[id] = {'promiseResolver': promiseResolver,
                                       'serverRequestInProgress': false,
                                       'count': 1}
                }
                else {
                  promiseResolver = this.requests[id]['promiseResolver'];
                  this.requests[id]['count']++;
                }
                
                if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                    console.log("Added request for id:" + id + ", now ", this.requests[id]['count'], " requests for this id, queue size is now:" + _.size(this.requests));
                }
                // Each id can take up to ~40 characters.  To not exceed
                // the 2048 characters unofficial limit for GET URLs,
                // (IE and others), we only request up to do up to:
                // 2000/40 ~= 50 id's at a time
                var unservicedRequests = _.filter(this.requests, function(request){ return request['serverRequestInProgress'] === false; });
                var numUnservicedRequests = _.size(unservicedRequests);
                if (numUnservicedRequests >= 50) {
                  if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                    console.log("Executing unserviced request immediately, unserviced queue size is now:", numUnservicedRequests);
                  }
                  //TODO:  This is suboptimal, as the server can still be hammered
                  //with concurrent requests for the same data, causing
                  //database contention.  Like a bit below, we should remember
                  //how many requests are in transit, and not have more than 3

                  //Alternatively, we could POST on a fake URL, with the url path
                  //as the body of the request and avoid this spliting completely.

                  this.executeRequest();
                }
                return promiseResolver.promise;
              },

              this.executeRequest = function () {

                var that = this,
                    allMessageStructureCollectionPromise = this.collectionManager.getAllMessageStructureCollectionPromise(),
                    ids = [];
                if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                  console.log("executeRequest fired, unregistering worker from collection Manager");
                }
                this.collectionManager._waitingWorker = undefined;

                _.each(that.requests, function (request, id) {
                  //var structureModel = allMessageStructureCollection.get(id);
                  if (request['serverRequestInProgress'] === false) {
                    request['serverRequestInProgress'] = true;
                    ids.push(id);
                  }
                });
                allMessageStructureCollectionPromise.then(function (allMessageStructureCollection) {
                  var PostQuery = require('views/messageListPostQuery'),
                      postQuery = new PostQuery(),
                      viewDef = 'default';

                  if (_.size(ids) > 0) {
                    postQuery.addFilter(postQuery.availableFilters.POST_HAS_ID_IN, ids);
                    postQuery.setViewDef(viewDef); //We want the full messages
                    if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                      console.log("requesting message data from server for "+ _.size(ids) + " messages");
                    }

                    postQuery.getResultRawDataPromise().then(function (results) {
                      _.each(results, function (jsonData) {
                        var id = jsonData['@id'],
                            structureModel = allMessageStructureCollection.get(id),
                            deferredList = that.requests[id];
  
                        if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                          console.log("executeRequest resolving for id", id, deferredList['count'], " requests queued for that id");
                        }
                        structureModel.set(jsonData);
                        structureModel.viewDef = viewDef;
                        if (deferredList !== undefined) {
                          deferredList['promiseResolver'].resolve(structureModel);
                          delete that.requests[id];
                        }
                        else {
                          console.log("WARNING: collectionManager::executeRequest() received data for " + id + ", but there is no matching request.  Race condition?");
                        }
                      });
                    });

                  }
                  else {
                    if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                      console.log("executeRequest called, but no ids to request from the server out of the list of ", _.size(that.requests));
                    }
                  }
                });

              }

              //Constructor
              if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                  console.log("Spawning new _getMessageFullModelsRequestWorker");
              }
              var that = this;
              this.executeTimeout = setTimeout(function () {
                if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                  console.log("Executing unserviced request immediately (timeaout reached)");
                }
                that.executeRequest();
              }, collectionManager.FETCH_WORKERS_LIFETIME);
            },

            /**
             * Need to be refactor with bluebird
             * */
            /*getMessageFullModelPromise: function (id) {
                var that = this,
                    deferred = $.Deferred(),
                    allMessageStructureCollectionPromise = this.getAllMessageStructureCollectionPromise();

                allMessageStructureCollectionPromise.then(function (allMessageStructureCollection) {
                    var structureModel = allMessageStructureCollection.get(id),
                        returnedModel = undefined;
                    if (structureModel) {
                        if (structureModel.viewDef !== undefined && structureModel.viewDef == "default") {
                            if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                                console.log("getMessageFullModelPromise CACHE HIT!")
                            }
                            deferred.resolve(structureModel);
                        }
                        else {
                            if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                                console.log("getMessageFullModelPromise CACHE MISS!")
                            }
                            if (that._waitingWorker === undefined) {
                                that._waitingWorker = new that.getMessageFullModelRequestWorker(that);
                            }
                            that._waitingWorker.addRequest(id, deferred);
                        }

                    }
                    else {
                        deferred.reject();
                    }
                });

                return deferred.promise();
            },*/

            getMessageFullModelPromise: function (id) {
                var that = this,
                    allMessageStructureCollectionPromise = this.getAllMessageStructureCollectionPromise();

                return allMessageStructureCollectionPromise.then(function (allMessageStructureCollection) {
                    var structureModel = allMessageStructureCollection.get(id);

                    if (structureModel) {
                        if (structureModel.viewDef !== undefined && structureModel.viewDef == "default") {
                            if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                                console.log("getMessageFullModelPromise CACHE HIT!");
                            }
                            return Promise.resolve(structureModel);
                        }
                        else {
                            if (CollectionManager.prototype.DEBUG_LAZY_LOADING) {
                                console.log("getMessageFullModelPromise CACHE MISS!");
                            }

                            if (that._waitingWorker === undefined) {
                                that._waitingWorker = new that.getMessageFullModelRequestWorker(that);
                            }
                            return that._waitingWorker.addRequest(id);
                        }
                    }
                    else {
                      return Promise.reject("MODEL NOT FOUND for id!"+id);
                    }
                });

            },

            /**
             * Retrieve fully populated models for the list of id's given
             * @param ids[] array of message id's
             * @return Message.Model{}
             */

            /*getMessageFullModelsPromise: function (ids) {
                var that = this,
                    deferred = $.Deferred(),
                    allMessageStructureCollectionPromise = this.getAllMessageStructureCollectionPromise(),
                    returnedModelsPromises = [];
                allMessageStructureCollectionPromise.done(function (allMessageStructureCollection) {
                    _.each(ids, function (id) {
                        returnedModelsPromises.push(that.getMessageFullModelPromise(id));
                    });
                    $.when.apply($, returnedModelsPromises).then(
                        function () {
                            var args = Array.prototype.slice.call(arguments);
                            //console.log("getMessageFullModelsPromise() resolved promises:", returnedModelsPromises);
                            //console.log("getMessageFullModelsPromise() resolving with:", args);
                            deferred.resolve(args);
                        },
                        function () {
                            console.log("getMessageFullModelsPromise: One of the id's couldn't be retrieved")
                            deferred.reject();
                        }
                    );
                });
                return deferred.promise();
            },*/

            getMessageFullModelsPromise: function (ids) {
                var that = this,
                    returnedCollection = undefined,
                    returnedModelsPromises = [],
                    allMessageStructureCollectionPromise = this.getAllMessageStructureCollectionPromise();

                _.each(ids, function (id) {
                        returnedModelsPromises.push(that.getMessageFullModelPromise(id));
                    });

                allMessageStructureCollectionPromise.done(function (allMessageStructureCollection) {
                    Promise.all(returnedModelsPromises).then(function () {
                        var args = Array.prototype.slice.call(arguments);
                        //console.log("getMessageFullModelsPromise() resolved promises:", returnedModelsPromises);
                        //console.log("getMessageFullModelsPromise() resolving with:", args);
                        returnedCollection = Promise.resolve(args);
                    }).catch(function (e) {
                        console.log("getMessageFullModelsPromise: One of the id's couldn't be retrieved", e.statusText);
                        Promise.reject();
                    });
                });

                return returnedCollection;
            },

            /*getAllSynthesisCollectionPromise: function () {
                var that = this,
                    deferred = $.Deferred();

                if (this._allSynthesisCollectionPromise === undefined) {
                    this._allSynthesisCollection = new Synthesis.Collection();
                    this._allSynthesisCollection.collectionManager = this;
                    this._allSynthesisCollectionPromise = this._allSynthesisCollection.fetch({
                        success: function (collection, response, options) {
                            deferred.resolve(that._allSynthesisCollection);
                        }
                    });
                }
                else {
                    this._allSynthesisCollectionPromise.done(function () {
                        deferred.resolve(that._allSynthesisCollection);
                    });
                }
                return deferred.promise();
            },*/

            getAllSynthesisCollectionPromise: function () {
                if (this._allSynthesisCollectionPromise) {
                    return this._allSynthesisCollectionPromise;
                }
                this._allSynthesisCollection = new Synthesis.Collection();
                this._allSynthesisCollection.collectionManager = this;
                this._allSynthesisCollectionPromise = Promise.resolve(this._allSynthesisCollection.fetch())
                    .thenReturn(this._allSynthesisCollection)
                    .catch(function(e){
                        console.error(e.statusText);
                    });

                return this._allSynthesisCollectionPromise;
            },

            /*getAllIdeasCollectionPromise: function () {
                var that = this,
                    deferred = $.Deferred();

                if (this._allIdeasCollectionPromise === undefined) {
                    this._allIdeasCollection = new Idea.Collection();
                    this._allIdeasCollection.collectionManager = this;
                    this._allIdeasCollectionPromise = this._allIdeasCollection.fetchFromScriptTag('ideas-json');
                    this._allIdeasCollectionPromise.done(function (collection, response, options) {
                        deferred.resolve(that._allIdeasCollection);
                        //Start listener setup
                        /*
                         this.listenTo(this.ideas, "all", function(eventName) {
                         console.log("ideaList collection event received: ", eventName);
                         });


                        //This is so the unread count update when setting a message unread.
                        //See Message:setRead()
                        Assembl.reqres.setHandler('ideas:update', function (ideas) {
                            if (Ctx.debugRender) {
                                console.log("ideaList: triggering render because app.on('ideas:update') was triggered");
                            }
                            that._allIdeasCollection.add(ideas, {merge: true});
                        });
                        //End listener setup
                    });
                }
                else {
                    this._allIdeasCollectionPromise.done(function () {
                        deferred.resolve(that._allIdeasCollection);
                    });
                }
                return deferred.promise();
            },*/

            getAllIdeasCollectionPromise: function () {
                var that = this;
                if (this._allIdeasCollectionPromise) {
                    return this._allIdeasCollectionPromise;
                }

                this._allIdeasCollection = new Idea.Collection();
                this._allIdeasCollection.collectionManager = this;
                this._allIdeasCollectionPromise = Promise.resolve(this._allIdeasCollection.fetchFromScriptTag('ideas-json'))
                    .thenReturn(this._allIdeasCollection)
                    .catch(function(e){
                        console.error(e.statusText);
                    });

                //Start listener setup
                //This is so the unread count update when setting a message unread.
                //See Message:setRead()
                Assembl.reqres.setHandler('ideas:update', function (ideas) {
                    if (Ctx.debugRender) {
                        console.log("ideaList: triggering render because app.on('ideas:update') was triggered");
                    }
                    that._allIdeasCollection.add(ideas, {merge: true});
                });
                //End listener setup

                return this._allIdeasCollectionPromise;

            },

            /*getAllIdeaLinksCollectionPromise: function () {
                var that = this,
                    deferred = $.Deferred();

                if (this._allIdeaLinksCollectionPromise === undefined) {
                    this._allIdeaLinksCollection = new IdeaLink.Collection();
                    this._allIdeaLinksCollection.collectionManager = this;
                    this._allIdeaLinksCollectionPromise = deferred.promise();
                    deferred.resolve(this._allIdeaLinksCollection);
                }
                return this._allIdeaLinksCollectionPromise;
            },*/

            getAllIdeaLinksCollectionPromise: function () {
                if (this._allIdeaLinksCollectionPromise) {
                    return this._allIdeaLinksCollectionPromise;
                }

                this._allIdeaLinksCollection = new IdeaLink.Collection();
                this._allIdeaLinksCollection.collectionManager = this;
                this._allIdeaLinksCollectionPromise = Promise.resolve(this._allIdeaLinksCollection.fetch())
                    .thenReturn(this._allIdeaLinksCollection)
                    .catch(function(e){
                        console.error(e.statusText);
                    });

                return this._allIdeaLinksCollectionPromise;
            },

            /*getAllExtractsCollectionPromise: function () {
                var that = this,
                    deferred = $.Deferred();

                if (this._allExtractsCollectionPromise === undefined) {
                    this._allExtractsCollection = new Segment.Collection();
                    this._allExtractsCollection.collectionManager = this;
                    this._allExtractsCollectionPromise = this._allExtractsCollection.fetchFromScriptTag('extracts-json');
                    this._allExtractsCollectionPromise.done(function () {
                        deferred.resolve(that._allExtractsCollection);
                    });
                }
                else {
                    this._allExtractsCollectionPromise.done(function () {
                        deferred.resolve(that._allExtractsCollection);
                    });
                }
                return deferred.promise();
            },*/

            getAllExtractsCollectionPromise: function () {
                if (this._allExtractsCollectionPromise) {
                    return this._allExtractsCollectionPromise;
                }

                this._allExtractsCollection = new Segment.Collection();
                this._allExtractsCollection.collectionManager = this;
                this._allExtractsCollectionPromise = Promise.resolve(this._allExtractsCollection.fetchFromScriptTag('extracts-json'))
                    .thenReturn(this._allExtractsCollection)
                    .catch(function(e){
                        console.error(e.statusText);
                    });

                return this._allExtractsCollectionPromise;
            },

            /*getAllPartnerOrganizationCollectionPromise: function () {
                var that = this,
                    deferred = $.Deferred();

                if (this._allPartnerOrganizationCollectionPromise === undefined) {
                    this._allPartnerOrganizationCollection = new PartnerOrg.Collection();
                    this._allPartnerOrganizationCollection.collectionManager = this;
                    this._allPartnerOrganizationCollectionPromise = this._allPartnerOrganizationCollection.fetch();
                    this._allPartnerOrganizationCollectionPromise.done(function () {
                        deferred.resolve(that._allPartnerOrganizationCollection);
                    });
                }
                else {
                    this._allPartnerOrganizationCollectionPromise.done(function () {
                        deferred.resolve(that._allPartnerOrganizationCollection);
                    });
                }
                return deferred.promise();
            },*/

            getAllPartnerOrganizationCollectionPromise: function () {
                if (this._allPartnerOrganizationCollectionPromise) {
                    return this._allPartnerOrganizationCollectionPromise;
                }
                this._allPartnerOrganizationCollection = new Partners.Collection();
                this._allPartnerOrganizationCollection.collectionManager = this;
                this._allPartnerOrganizationCollectionPromise = Promise.resolve(this._allPartnerOrganizationCollection.fetch())
                    .thenReturn(this._allPartnerOrganizationCollection)
                    .catch(function(e){
                        console.error(e.statusText);
                    });

                return this._allPartnerOrganizationCollectionPromise;
            },

            /*getNotificationsDiscussionCollectionPromise: function () {
                var that = this,
                    deferred = $.Deferred();

                if (this._allNotificationsDiscussionCollectionPromise === undefined) {
                    this._allNotificationsDiscussionCollection = new NotificationSubscription.Collection();
                    this._allNotificationsDiscussionCollection.setUrlToDiscussionTemplateSubscriptions();
                    this._allNotificationsDiscussionCollection.collectionManager = this;
                    this._allNotificationsDiscussionCollectionPromise = this._allNotificationsDiscussionCollection.fetch();
                    this._allNotificationsDiscussionCollectionPromise.done(function () {
                        deferred.resolve(that._allNotificationsDiscussionCollection);
                    });
                }
                else {
                    this._allNotificationsDiscussionCollectionPromise.done(function () {
                        deferred.resolve(that._allNotificationsDiscussionCollection);
                    });
                }
                return deferred.promise();
            },*/

            getNotificationsDiscussionCollectionPromise: function () {
                if (this._allNotificationsDiscussionCollectionPromise) {
                    return this._allNotificationsDiscussionCollectionPromise;
                }
                this._allNotificationsDiscussionCollection = new NotificationSubscription.Collection();
                this._allNotificationsDiscussionCollection.setUrlToDiscussionTemplateSubscriptions();
                this._allNotificationsDiscussionCollection.collectionManager = this;
                this._allNotificationsDiscussionCollectionPromise = Promise.resolve(this._allNotificationsDiscussionCollection.fetch())
                    .thenReturn(this._allNotificationsDiscussionCollection)
                    .catch(function(e){
                        console.error(e.statusText);
                    })

                return this._allNotificationsDiscussionCollectionPromise;
            },

            /*getNotificationsUserCollectionPromise: function () {
                var that = this,
                    deferred = $.Deferred();

                if (this._allNotificationsUserCollectionPromise === undefined) {
                    this._allNotificationsUserCollection = new NotificationSubscription.Collection();
                    this._allNotificationsUserCollection.setUrlToUserSubscription();
                    this._allNotificationsUserCollection.collectionManager = this;
                    this._allNotificationsUserCollectionPromise = this._allNotificationsUserCollection.fetch();
                    this._allNotificationsUserCollectionPromise.done(function () {
                        deferred.resolve(that._allNotificationsUserCollection);
                    });
                }
                else {
                    this._allNotificationsUserCollectionPromise.done(function () {
                        deferred.resolve(that._allNotificationsUserCollection);
                    });
                }
                return deferred.promise();
            },*/

            getNotificationsUserCollectionPromise: function () {
                if (this._allNotificationsUserCollectionPromise) {
                    return this._allNotificationsUserCollectionPromise;
                }

                this._allNotificationsUserCollection = new NotificationSubscription.Collection();
                this._allNotificationsUserCollection.setUrlToUserSubscription();
                this._allNotificationsUserCollection.collectionManager = this;
                this._allNotificationsUserCollectionPromise = Promise.resolve(this._allNotificationsUserCollection.fetch())
                    .thenReturn(this._allNotificationsUserCollection)
                    .catch(function(e){
                        console.error(e.statusText);
                    });

                return this._allNotificationsUserCollectionPromise;

            },

            /*
             * Gets the stored configuration of groups and panels
             */
            getGroupSpecsCollectionPromise: function (viewsFactory) {
                var deferred = $.Deferred();

                if (this._allGroupSpecsCollectionPromise === undefined) {
                    var collection,
                        data = Storage.getStorageGroupItem();
                    if (data !== undefined) {
                        collection = new groupSpec.Collection(data, {'parse': true, 'viewsFactory': viewsFactory});
                        if (!collection.validate()) {
                            console.error("getGroupSpecsCollectionPromise(): Collection in local storage is invalid, will return a new one");
                            collection = undefined;
                        }
                    }
                    if (collection === undefined) {
                        collection = new groupSpec.Collection();
                        var panelSpec = require('models/panelSpec');
                        var PanelSpecTypes = require('utils/panelSpecTypes');
                        var defaults = {
                            panels: new panelSpec.Collection([
                                    {type: PanelSpecTypes.NAV_SIDEBAR.id },
                                    {type: PanelSpecTypes.IDEA_PANEL.id, minimized: true},
                                    {type: PanelSpecTypes.MESSAGE_LIST.id}
                                ],
                                {'viewsFactory': viewsFactory }),
                            navigationState: 'home'
                        };
                        collection.add(new groupSpec.Model(defaults, {'viewsFactory': viewsFactory }));

                    }
                    collection.collectionManager = this;
                    Storage.bindGroupSpecs(collection);

                    this._allGroupSpecsCollectionPromise = deferred.promise();
                    deferred.resolve(collection);
                }
                return this._allGroupSpecsCollectionPromise;
            },

            /*getLocalRoleCollectionPromise: function () {
                var that = this,
                    deferred = $.Deferred();

                if (this._allLocalRoleCollectionPromise === undefined) {
                    this._allLocalRoleCollection = new LocalRole.Collection();
                    this._allLocalRoleCollection.collectionManager = this;
                    this._allLocalRoleCollectionPromise = this._allLocalRoleCollection.fetch();
                    this._allLocalRoleCollectionPromise.done(function () {
                        deferred.resolve(that._allLocalRoleCollection);
                    });
                }
                else {
                    this._allLocalRoleCollectionPromise.done(function () {
                        deferred.resolve(that._allLocalRoleCollection);
                    });
                }
                return deferred.promise();
            },*/

            getLocalRoleCollectionPromise: function () {
                if (this._allLocalRoleCollectionPromise) {
                    return this._allLocalRoleCollectionPromise;
                }

                this._allLocalRoleCollection = new LocalRole.Collection();
                this._allLocalRoleCollection.collectionManager = this;
                this._allLocalRoleCollectionPromise = Promise.resolve(this._allLocalRoleCollection.fetch())
                    .thenReturn(this._allLocalRoleCollection)
                    .catch(function(e){
                        console.error(e.statusText);
                    });

                return this._allLocalRoleCollectionPromise;
            },

            /*getDiscussionModelPromise: function () {
                var that = this,
                    deferred = Marionette.Deferred();

                if (this._allDiscussionModelPromise === undefined) {
                    this._allDiscussionModel = new Discussion.Model();
                    this._allDiscussionModel.collectionManager = this;
                    this._allDiscussionModelPromise = this._allDiscussionModel.fetch();
                    this._allDiscussionModelPromise.done(function () {
                        deferred.resolve(that._allDiscussionModel);
                    });
                }
                else {
                    this._allDiscussionModelPromise.done(function () {
                        deferred.resolve(that._allDiscussionModel);
                    });
                }
                return deferred.promise();

            },*/

            getDiscussionModelPromise: function () {
                if (this._allDiscussionModelPromise) {
                    return this._allDiscussionModelPromise;
                }

                this._allDiscussionModel = new Discussion.Model();
                this._allDiscussionModel.collectionManager = this;
                this._allDiscussionModelPromise = Promise.resolve(this._allDiscussionModel.fetch())
                    .thenReturn(this._allDiscussionModel)
                    .catch(function(e){
                        console.error(e.statusText);
                    });

                return this._allDiscussionModelPromise;
            },

            /*getDiscussionSourceCollectionPromise: function () {
                var that = this,
                    deferred = Marionette.Deferred();

                if (this._allDiscussionSourceCollectionPromise === undefined) {
                    this._allDiscussionSourceCollection = new DiscussionSource.Collection();
                    this._allDiscussionSourceCollection.collectionManager = this;
                    this._allDiscussionSourceCollectionPromise = this._allDiscussionSourceCollection.fetch();
                    this._allDiscussionSourceCollectionPromise.done(function () {
                        deferred.resolve(that._allDiscussionSourceCollection);
                    });
                }
                else {
                    this._allDiscussionSourceCollectionPromise.done(function () {
                        deferred.resolve(that._allDiscussionSourceCollection);
                    });
                }
                return deferred.promise();

            }*/

            getDiscussionSourceCollectionPromise: function () {
                if (this._allDiscussionSourceCollectionPromise) {
                    return this._allDiscussionSourceCollectionPromise;
                }
                this._allDiscussionSourceCollection = new DiscussionSource.Collection();
                this._allDiscussionSourceCollection.collectionManager = this;
                this._allDiscussionSourceCollectionPromise = Promise.resolve(this._allDiscussionSourceCollection.fetch())
                    .thenReturn(this._allDiscussionSourceCollection)
                    .catch(function(e){
                        console.error(e.statusText);
                    });

                return this._allDiscussionSourceCollectionPromise;
            }

        });

        var _instance;

        return function () {
            if (!_instance) {
                _instance = new CollectionManager();
            }
            return _instance;
        };

    });