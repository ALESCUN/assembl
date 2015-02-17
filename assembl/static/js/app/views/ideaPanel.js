'use strict';

define(['app', 'common/context', 'utils/i18n', 'views/editableField', 'views/ckeditorField', 'utils/permissions', 'utils/panelSpecTypes', 'views/messageSend', 'objects/messagesInProgress', 'views/notification', 'views/segmentList', 'common/collectionManager', 'views/assemblPanel', 'backbone.marionette', 'backbone.modal', 'backbone.marionette.modals', 'jquery', 'underscore'],
    function (Assembl, Ctx, i18n, EditableField, CKEditorField, Permissions, PanelSpecTypes, MessageSendView, MessagesInProgress, Notification, SegmentList, CollectionManager, AssemblPanel, Marionette, backboneModal, marionetteModal, $, _) {

        var IdeaPanelWidgets = Marionette.ItemView.extend({

            // custom properties

            inspiration_widget_create_url: null,
            inspiration_widgets: null,
            inspiration_widget_url: null,
            inspiration_widget_configure_url: null,
            vote_widget_create_url: null,
            vote_widgets: null,


            // overwritten properties and methods

            template: '#tmpl-ideaPanelWidgets',
            initialize: function (options) {
                if (!this.model) {
                    this.model = null;
                }
            },

            modelEvents: {
                'change': 'render'
            },
            ui: {
                'modal': '.js_openTargetInModal'
            },
            events: {
                'click @ui.modal': 'openTargetInModal'
            },

            serializeData: function () {
                var currentUser = Ctx.getCurrentUser(),
                    idea = null;

                if (this.model) {
                    //console.log("there is a model");
                    idea = this.model;
                }

                return {
                    ctx: Ctx,
                    i18n: i18n,
                    idea: idea,
                    canUseWidget: currentUser.can(Permissions.ADD_POST),
                    canCreateWidgets: currentUser.can(Permissions.ADMIN_DISCUSSION),
                    inspiration_widget_create_url: this.inspiration_widget_create_url,
                    inspiration_widgets: this.inspiration_widgets,
                    inspiration_widget_url: this.inspiration_widget_url,
                    inspiration_widget_configure_url: this.inspiration_widget_configure_url,
                    vote_widget_create_url: this.vote_widget_create_url,
                    vote_widgets: this.vote_widgets
                };
            },

            onRender: function(){
                this.populateAssociatedWidgetData();
            },


            // custom methods

            clearWidgetDataAssociatedToIdea: function () {
                // console.log("clearWidgetDataAssociatedToIdea()");
                this.resetAssociatedWidgetData();
                /* In case once the admin deletes the widget after having opened the configuration modal,
                 we have to invalidate widget data for this idea and all its sub-ideas recursively.
                 So to make it more simple we invalidate all widget data. */
                Ctx.invalidateWidgetDataAssociatedToIdea("all");
            },

            resetAssociatedWidgetData: function() {
                this.inspiration_widget_create_url = null;
                this.inspiration_widgets = null;
                this.inspiration_widget_url = null;
                this.inspiration_widget_configure_url = null;
                this.vote_widget_create_url = null;
                this.vote_widgets = null;
            },

            populateAssociatedWidgetData: function () {
                if (this.model) {
                    var that = this;
                    var previous = {};
                    previous.inspiration_widget_create_url = that.inspiration_widget_create_url;
                    previous.inspiration_widgets = that.inspiration_widgets;
                    previous.inspiration_widget_url = that.inspiration_widget_url;
                    previous.inspiration_widget_configure_url = that.inspiration_widget_configure_url;
                    previous.vote_widget_create_url = that.vote_widget_create_url;
                    previous.vote_widgets = that.vote_widgets;
                    var promise = Ctx.getWidgetDataAssociatedToIdeaPromise(this.model.getId());
                    promise.done(
                        function (data) {
                            //console.log("populateAssociatedWidgetData received data: ", data);

                            that.resetAssociatedWidgetData();

                            if ("inspiration_widget_create_url" in data) {
                                that.inspiration_widget_create_url = data.inspiration_widget_create_url;
                            }

                            if ("inspiration_widgets" in data) {
                                that.inspiration_widgets = data.inspiration_widgets;
                            }

                            if ("inspiration_widget_url" in data) {
                                that.inspiration_widget_url = data.inspiration_widget_url;
                            }

                            if ("inspiration_widget_configure_url" in data) {
                                that.inspiration_widget_configure_url = data.inspiration_widget_configure_url;
                                //console.log("inspiration_widget_configure_url: ", data.inspiration_widget_configure_url);
                            }

                            if ("vote_widget_create_url" in data) {
                                that.vote_widget_create_url = data.vote_widget_create_url;
                                //console.log("vote_widget_create_url: ", data.vote_widget_create_url);
                            }

                            if ("vote_widgets" in data) {
                                that.vote_widgets = data.vote_widgets;
                                //console.log("vote_widgets: ", data.vote_widgets);
                            }

                            if (
                                previous.inspiration_widget_create_url != that.inspiration_widget_create_url
                                || previous.inspiration_widgets != that.inspiration_widgets
                                || previous.inspiration_widget_url != that.inspiration_widget_url
                                || previous.inspiration_widget_configure_url != that.inspiration_widget_configure_url
                                || previous.vote_widget_create_url != that.vote_widget_create_url
                                || previous.vote_widgets != that.vote_widgets
                            ) {

                                that.render();
                            }
                        }
                    );
                }

            },

            openTargetInModal: function (evt) {
                var that = this;
                var onDestroyCallback = function () {
                    //console.log("openTargetInModal onDestroyCallback()");
                    setTimeout(function () {
                        //Ctx.invalidateWidgetDataAssociatedToIdea("all");
                        that.clearWidgetDataAssociatedToIdea();
                        //that.fetchModelAndRender();
                        that.render();
                    }, 0);
                };
                var options = {
                    footer: false
                };
                if (evt && evt.currentTarget && $(evt.currentTarget).hasClass("js_clearWidgetDataAssociatedToIdea"))
                {
                    //console.log("openTargetInModal has js_clearWidgetDataAssociatedToIdea");
                    return Ctx.openTargetInModal(evt, onDestroyCallback, options);
                }
                else
                {
                    //console.log("openTargetInModal has not js_clearWidgetDataAssociatedToIdea");
                    return Ctx.openTargetInModal(evt, null, options);
                }
            }

        });

        var IdeaPanel = AssemblPanel.extend({
            template: '#tmpl-ideaPanel',
            panelType: PanelSpecTypes.IDEA_PANEL,
            className: 'ideaPanel',
            minimizeable: true,
            closeable: false,
            gridSize: AssemblPanel.prototype.IDEA_PANEL_GRID_SIZE,
            minWidth: 270,
            regions: {
                //segmentList: ".postitlist"
                widgetsInteraction: ".ideaPanel-section-widgets"
            },
            initialize: function (options) {
                Object.getPrototypeOf(Object.getPrototypeOf(this)).initialize.apply(this, arguments);
                var that = this;

                this.editingDefinition = false;
                this.editingTitle = false;

                if (!this.model) {
                    this.model = null;
                }

                this.listenTo(this.getContainingGroup(), "idea:set", function (idea) {
                    that.setIdeaModel(idea);
                });

                this.listenTo(Assembl.vent, 'DEPRECATEDideaPanel:showSegment', function (segment) {
                    that.showSegment(segment);
                });

            },
            ui: {
                'postIt': '.postitlist',
                'definition': '.js_editDefinition',
                'longTitle': '.js_editLongTitle',
                'seeMore': '.js_seeMore',
                'seeLess': '.js_seeLess',
                'deleteIdea': '.js_ideaPanel-deleteBtn',
                'clearIdea': '.js_ideaPanel-clearBtn',
                'closeExtract': '.js_closeExtract'
            },
            modelEvents: {
                //Do NOT listen to change here
                //'replacedBy': 'onReplaced',
                'change': 'render'
            },
            events: {
                'dragstart .bx': 'onDragStart',
                'dragend .bx': "onDragEnd",
                'dragover': 'onDragOver',
                'dragleave': 'onDragLeave',
                'drop': 'onDrop',
                'click @ui.closeExtract': 'onSegmentCloseButtonClick',
                'click @ui.clearIdea': 'onClearAllClick',
                'click @ui.deleteIdea': 'onDeleteButtonClick',
                'click @ui.seeMore': 'seeMoreOrLess',
                'click @ui.seeLess': 'seeMoreOrLess',
                'click @ui.definition': 'editDefinition',
                'click @ui.longTitle': 'editTitle'
            },

            getTitle: function () {
                return i18n.gettext('Idea');
            },

            tooltip: i18n.gettext('Detailled information about the currently selected idea in the Table of ideas'),

            resetView: function () {
              if(this.segmentList !== undefined) {
                this.segmentList.reset();
              }
              else {
                console.log("ideaPanel::resetView called, but region doesn't exist");
              }
            },

            /**
             * This is not inside the template because babel wouldn't extract it in
             * the pot file
             */
            getSubIdeasLabel: function (subIdeas) {
                if (subIdeas.length == 0) {
                    return i18n.gettext('This idea has no sub-ideas');
                }
                else {
                    return i18n.sprintf(i18n.ngettext('This idea has %d sub-idea', 'This idea has %d sub-ideas', subIdeas.length), subIdeas.length);
                }
            },
            /**
             * This is not inside the template because babel wouldn't extract it in
             * the pot file
             */
            getExtractsLabel: function () {
                var len = 0;

                if (this.extractListSubset) {
                    len = this.extractListSubset.models.length;
                }
                if (len == 0) {
                    if (Ctx.getCurrentUser().can(Permissions.ADD_EXTRACT)) {
                        return i18n.gettext('No extract was harvested');
                    }
                    else {
                        return i18n.gettext('No important nugget was harvested');
                    }
                }
                else {
                    if (Ctx.getCurrentUser().can(Permissions.ADD_EXTRACT)) {
                        return i18n.sprintf(i18n.ngettext('%d extract was harvested', '%d extracts were harvested', len), len);
                    }
                    else {
                        return i18n.sprintf(i18n.ngettext('%d important nugget was harvested', '%d important nuggets were harvested', len), len);
                    }
                }
            },

            renderTemplateGetExtractsLabel: function () {
                this.$('.ideaPanel-section-segments-legend .legend').html(
                    this.getExtractsLabel());
            },

            serializeData: function () {
                if (Ctx.debugRender) {
                    console.log("ideaPanel::serializeData()");
                }
                var subIdeas = {},
                    currentUser = Ctx.getCurrentUser(),
                    canEdit = currentUser.can(Permissions.EDIT_IDEA) || false,
                    canEditNextSynthesis = currentUser.can(Permissions.EDIT_SYNTHESIS),
                    contributors = null;

                if (this.model) {
                    //console.log("there is a model");
                    subIdeas = this.model.getChildren();
                    contributors = this.model.get('contributors');
                }
                else
                {
                    //console.log("there is no model");
                }

                var dataset = {
                    idea: this.model,
                    contributors: contributors,
                    subIdeas: subIdeas,
                    canEdit: canEdit,
                    i18n: i18n,
                    getExtractsLabel: this.getExtractsLabel,
                    getSubIdeasLabel: this.getSubIdeasLabel,
                    canDelete: currentUser.can(Permissions.EDIT_IDEA),
                    canEditNextSynthesis: canEditNextSynthesis,
                    canEditExtracts: currentUser.can(Permissions.EDIT_EXTRACT),
                    canEditMyExtracts: currentUser.can(Permissions.EDIT_MY_EXTRACT),
                    canAddExtracts: currentUser.can(Permissions.EDIT_EXTRACT), //TODO: This is a bit too coarse
                    Ctx: Ctx,
                    editingDefinition: this.editingDefinition,
                    editingTitle: this.editingTitle
                };

                return dataset;
            },

            onRender: function () {
                if (Ctx.debugRender) {
                    console.log("ideaPanel::onRender()");
                }
                Ctx.removeCurrentlyDisplayedTooltips(this.$el);

                Ctx.initTooltips(this.$el);

                Ctx.initClipboard();

                if (this.model && this.model.id  && this.extractListSubset) { 
                  //Only fetch extracts if idea already has an id.
                  //console.log(this.extractListSubset);
                    // display only important extract for simple user
                    if (!Ctx.getCurrentUser().can(Permissions.ADD_EXTRACT)) {
                        this.extractListSubset.models = _.filter(this.extractListSubset.models, function (model) {
                            return model.get('important');
                        });
                    }

                    this.getExtractslist();

                    this.displayEditableFields();

                    this.onTruncate();

                    if (this.editingDefinition) {
                        this.renderCKEditorDefinition();
                    }

                    if (this.editingTitle) {
                        this.renderCKEditorLongTitle();
                    }

                    var ideaPanelWidgets = new IdeaPanelWidgets({model: this.model});
                    this.widgetsInteraction.show(ideaPanelWidgets);
                }

            },

            getExtractslist: function () {
                var that = this,
                    collectionManager = new CollectionManager();

                if (this.extractListSubset) {
                    $.when(
                        collectionManager.getAllExtractsCollectionPromise(),
                        collectionManager.getAllUsersCollectionPromise(),
                        collectionManager.getAllMessageStructureCollectionPromise()
                    ).then(
                        function (allExtractsCollection, allUsersCollection, allMessagesCollection) {
                            that.extractListView = new SegmentList.SegmentListView({
                                collection: that.extractListSubset,
                                allUsersCollection: allUsersCollection,
                                allMessagesCollection: allMessagesCollection
                            });

                            //TODO: override show method to remove dom before inject
                            that.ui.postIt.html(that.extractListView.render().el);
                            //that.segmentList.show(that.extractListView);

                            that.renderTemplateGetExtractsLabel();
                        });
                } else {
                    this.renderTemplateGetExtractsLabel();
                }
            },

            displayEditableFields: function () {

                var currentUser = Ctx.getCurrentUser(),
                    canEdit = currentUser.can(Permissions.EDIT_IDEA) || false,
                    canEditNextSynthesis = currentUser.can(Permissions.EDIT_SYNTHESIS),
                    modelId = this.model.id,
                    partialMessage = MessagesInProgress.getMessage(modelId);

                var shortTitleField = new EditableField({
                    'model': this.model,
                    'modelProp': 'shortTitle',
                    'class': 'panel-editablearea text-bold',
                    'data-tooltip': i18n.gettext('Short expression (only a few words) of the idea in the table of ideas.'),
                    'placeholder': i18n.gettext('New idea'),
                    'canEdit': canEdit
                });
                shortTitleField.renderTo(this.$('#ideaPanel-shorttitle'));

                // the content is replace by CKEditorField not necessary to init with
                /*this.longTitleField = new CKEditorField({
                    'model': this.model,
                    'modelProp': 'longTitle',
                    'placeholder': this.model.getLongTitleDisplayText(),
                    'canEdit': canEditNextSynthesis,
                    'showPlaceholderOnEditIfEmpty': true
                });*/
                //this.longTitleField.renderTo(this.$('.ideaPanel-longtitle'));

                this.commentView = new MessageSendView({
                    'allow_setting_subject': false,
                    'reply_idea_id': this.model.getId(),
                    'body_help_message': i18n.gettext('Comment on this idea here...'),
                    'send_button_label': i18n.gettext('Send your comment'),
                    'subject_label': null,
                    'msg_in_progress_body': partialMessage['body'],
                    'msg_in_progress_ctx': modelId,
                    'mandatory_body_missing_msg': i18n.gettext('You need to type a comment first...'),
                    'mandatory_subject_missing_msg': null
                    //TODO:  Pass the messageListView that is expected to refresh with the new comment
                });
                this.$('#ideaPanel-comment').append(this.commentView.render().el);

            },

            /**
             * Add a segment
             * @param  {Segment} segment
             */
            addSegment: function (segment) {
                delete segment.attributes.highlights;

                var id = this.model.getId();
                segment.save('idIdea', id, {
                    success: function (model, reps) {
                    },
                    error: function (model, resp) {
                        console.error('ERROR: addSegment', resp);
                    }
                });
            },

            /**
             * Shows the given segment with an small fx
             * @param {Segment} segment
             */
            showSegment: function (segment) {
                var that = this,
                    selector = Ctx.format('.box[data-segmentid={0}]', segment.cid),
                    idIdea = segment.get('idIdea'),
                    box,
                    collectionManager = new CollectionManager();

                collectionManager.getAllIdeasCollectionPromise().done(
                    function (allIdeasCollection) {
                        var idea = allIdeasCollection.get(idIdea);
                        if (!idea) {
                            return;
                        }

                        that.setIdeaModel(idea);
                        box = that.$(selector);

                        if (box.length) {
                            var panelBody = that.$('.panel-body');
                            var panelOffset = panelBody.offset().top;
                            var offset = box.offset().top;
                            // Scrolling to the element
                            var target = offset - panelOffset + panelBody.scrollTop();
                            panelBody.animate({ scrollTop: target });
                            box.highlight();
                        }
                    }
                );
            },

            onReplaced: function (newObject) {
                if (this.model !== null) {
                    this.stopListening(this.model, 'replacedBy acquiredId');
                }
                this.setIdeaModel(newObject);
            },

            /**
             * Set the given idea as the current one
             * @param  {Idea} [idea=null]
             */
            setIdeaModel: function (idea) {
                var that = this,
                    collectionManager = new CollectionManager();

                //console.log("setIdeaModel called with", idea);
                if (idea !== this.model) {
                    if (this.model !== null) {
                        this.stopListening(this.model);
                    }
                    this.model = idea;
                    this.editingDefinition = false;
                    this.editingTitle = false;
                    //console.log("this.extractListSubset before setIdea:", this.extractListSubset);
                    if (this.extractListSubset) {
                        this.stopListening(this.extractListSubset);
                        this.extractListSubset = null;
                    }
                    if (this.extractListView) {
                        this.extractListView.unbind();
                        this.extractListView = null;
                    }
                    if (this.model) {
                        //this.resetView();

                        this.listenTo(this.model, 'acquiredId', function (m) {
                            // model has acquired an ID. Reset everything.
                            var model = that.model;
                            that.model = null;
                            that.setIdeaModel(model);
                        });
                        if (this.model.id) {
                            //Ctx.openPanel(assembl.ideaPanel);
                            //console.log("ideaPanel::setIdeaModel() fetching models");
                            //this.populateAssociatedWidgetData();

                            this.fetchModelAndRender();
                        }
                    } else {
                        //TODO: More sophisticated behaviour here, depending
                        //on if the panel was opened by selection, or by something else.
                        //app.closePanel(app.ideaPanel);
                        //this.resetView();
                        //this.render();
                    }
                }
            },

            fetchModelAndRender: function(){
                var that = this,
                    collectionManager = new CollectionManager();
                var fetchPromise = this.model.fetch({ data: $.param({ view: 'contributors'}) });
                            
                $.when(collectionManager.getAllExtractsCollectionPromise(), fetchPromise).then(
                    function (allExtractsCollection, fetchedJQHR) {
                        that.extractListSubset = new SegmentList.IdeaSegmentListSubset([], {
                            parent: allExtractsCollection,
                            ideaId: that.model.id
                        });
                        that.listenTo(that.extractListSubset, "add remove reset change", that.renderTemplateGetExtractsLabel);
                        //console.log("The region:", that.segmentList);
                        that.render();
                        /*that.listenTo(that.model, 'change', function (m) {
                          // console.log("ideaPanel::change callback about to call render");
                          that.render();
                        });*/
                    }
                );
            },

            deleteCurrentIdea: function () {
                // to be deleted, an idea cannot have any children nor segments
                var that = this,
                    children = this.model.getChildren();

                this.blockPanel();
                $.when(
                    this.model.getExtractsPromise()
                ).then(
                    function (ideaExtracts) {
                        that.unblockPanel();
                        if (children.length > 0) {
                            that.unblockPanel();
                            alert(i18n.gettext('You cannot delete an idea while it has sub-ideas.'));
                        }
                        // Nor has any segments
                        else if (ideaExtracts.length > 0) {
                            that.unblockPanel();
                            alert(i18n.gettext('You cannot delete an idea associated to extracts.'));
                        }
                        else {
                            // That's a bingo
                            var ok = confirm(i18n.gettext('Confirm that you want to delete this idea.'));

                            if (ok) {
                                that.model.destroy({
                                    success: function () {
                                        that.unblockPanel();
                                        that.getContainingGroup().setCurrentIdea(null);
                                    },
                                    error: function (model, resp) {
                                        console.error('ERROR: deleteCurrentIdea', resp);
                                    }
                                });
                            }
                            else {
                                that.unblockPanel();
                            }
                        }
                    });
            },

            onDragStart: function (ev) {
                var that = this,
                    collectionManager = new CollectionManager();
                //TODO: Deal with editing own extract (EDIT_MY_EXTRACT)
                collectionManager.getAllExtractsCollectionPromise().done(
                    function (allExtractsCollection) {
                        if (Ctx.getCurrentUser().can(Permissions.EDIT_EXTRACT)) {
                            ev.currentTarget.style.opacity = 0.4;

                            var cid = ev.currentTarget.getAttribute('data-segmentid'),
                                segment = allExtractsCollection.getByCid(cid);
                            Ctx.showDragbox(ev, segment.getQuote());
                            Ctx.draggedSegment = segment;
                        }
                    });

            },

            onDragEnd: function (ev) {
                ev.currentTarget.style.opacity = '';
                Ctx.draggedSegment = null;
            },

            onDragOver: function (ev) {
                // console.log("ideaPanel:onDragOver() fired");
                ev.preventDefault();
                if (Ctx.draggedSegment !== null || Ctx.getDraggedAnnotation() !== null) {
                    this.$el.addClass("is-dragover");
                }
            },

            onDragLeave: function () {
                //console.log("ideaPanel:onDragLeave() fired");
                this.$el.removeClass('is-dragover');
            },

            onDrop: function (ev) {
                //console.log("ideaPanel:onDrop() fired");
                if (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }

                this.$el.trigger('dragleave');

                var segment = Ctx.getDraggedSegment();
                if (segment) {
                    this.addSegment(segment);
                }
                var annotation = Ctx.getDraggedAnnotation();
                if (annotation) {
                    // Add as a segment
                    Ctx.currentAnnotationIdIdea = this.model.getId();
                    Ctx.currentAnnotationNewIdeaParentIdea = null;
                    Ctx.saveCurrentAnnotationAsExtract();
                    return;
                }

            },

            onSegmentCloseButtonClick: function (ev) {
                var that = this,
                    cid = ev.currentTarget.getAttribute('data-segmentid'),
                    collectionManager = new CollectionManager();
                collectionManager.getAllExtractsCollectionPromise().done(
                    function (allExtractsCollection) {
                        var segment = allExtractsCollection.get(cid);

                        if (segment) {
                            segment.save('idIdea', null);
                        }
                    });
            },

            onClearAllClick: function (ev) {
                var ok = confirm(i18n.gettext('Confirm that you want to send all extracts back to the clipboard.'));
                if (ok) {
                    // Clone first, because the operation removes extracts from the subset.
                    var models = _.clone(this.extractList.models)
                    _.each(models, function(extract) {
                        extract.set('idIdea', null);
                    });
                    _.each(models, function(extract) {
                        extract.save();
                    });
                }
            },

            onDeleteButtonClick: function () {
                this.deleteCurrentIdea();
            },

            seeMoreOrLess: function (e) {
                e.preventDefault();

                var elm = $(e.target),
                    seeMore = this.$('.seeMore'),
                    seeLess = this.$('.seeLess'),
                    lessContent = this.$('.lesscontent'),
                    hideContent = this.$('.morecontent');

                if (elm.hasClass('seeMore')) {
                    hideContent.removeClass('hidden');
                    seeMore.addClass('hidden');
                    seeLess.removeClass('hidden');
                    lessContent.addClass('hidden');
                }

                if (elm.hasClass('seeLess')) {
                    hideContent.addClass('hidden');
                    seeMore.removeClass('hidden');
                    seeLess.addClass('hidden');
                    lessContent.removeClass('hidden');
                }
            },

            onTruncate: function () {

                var definition = this.model.get('definition').length,
                    body = this.$('.ideaPanel-definition').text(),
                    seeMore = this.$('.seeMore'),

                    showChar = 300;

                if (definition > showChar) {

                    var content = body.substr(0, showChar) + '<span class="lesscontent">...</span>',
                        hiddenContent = body.substr(showChar, definition - showChar),
                        html = content + '<span class="morecontent hidden">' + hiddenContent + '</span>';

                    this.$('.ideaPanel-definition').html(html);

                    seeMore.removeClass('hidden');
                }
            },

            editDefinition: function () {
                if (Ctx.getCurrentUser().can(Permissions.EDIT_IDEA)) {
                    this.editingDefinition = true;
                    this.render();
                }
            },

            editTitle: function () {
                if (Ctx.getCurrentUser().can(Permissions.EDIT_IDEA)) {
                    this.editingTitle = true;
                    this.render();
                }
            },

            renderCKEditorDefinition: function () {
                var that = this,
                    area = this.$('.ideaPanel-definition-editor');

                var definitionText = this.model.getDefinitionDisplayText();

                if (definitionText.length > 0) {

                    this.definition = new CKEditorField({
                        'model': this.model,
                        'modelProp': 'definition'
                    });
                }

                this.definition.on('save cancel', function () {
                    that.editingDefinition = false;
                    that.render();
                });

                this.definition.renderTo(area);
                this.definition.changeToEditMode();
            },

            renderCKEditorLongTitle: function () {
                var that = this,
                    area = this.$('.ideaPanel-longtitle-editor');

                var longTitle = this.model.getLongTitleDisplayText();

                if (longTitle.length > 0) {

                    this.shortTitle = new CKEditorField({
                        'model': this.model,
                        'modelProp': 'longTitle'
                    });
                }

                this.shortTitle.on('save cancel', function () {
                    that.editingTitle = false;
                    that.render();
                });

                this.shortTitle.renderTo(area);
                this.shortTitle.changeToEditMode();
            }

        });

        return IdeaPanel;
    });
