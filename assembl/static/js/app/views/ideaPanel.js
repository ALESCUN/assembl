define(function(require){
    'use strict';

    var Backbone = require('backbone'),
         Assembl = require('modules/assembl'),
             Ctx = require('modules/context'),
            i18n = require('utils/i18n'),
   EditableField = require('views/editableField'),
   CKEditorField = require('views/ckeditorField'),
     Permissions = require('utils/permissions'),
 MessageSendView = require('views/messageSend'),
    Notification = require('views/notification'),
CollectionManager = require('modules/collectionManager');

    var LONG_TITLE_ID = 'ideaPanel-longtitle';

    /**
     * @class IdeaPanel
     */
    var IdeaPanel = Backbone.View.extend({

        /**
         * The tempate
         * @type {_.template}
         */
        template: Ctx.loadTemplate('ideaPanel'),

        /**
         * @init
         */
        initialize: function(obj){
            obj = obj || {};

            var that = this;

            if( obj.button ){
                this.button = $(obj.button).on('click', Ctx.togglePanel.bind(window, 'ideaPanel'));
            }

            if( this.model ){
                this.listenTo(this.model, 'change', this.render);
            }
            else {
               this.model = null;
            }

            Assembl.vent.on("idea:selected", function(idea){
                that.setIdeaModel(idea);

            });

        },
        /**
         * This is not inside the template beacuse babel wouldn't extract it in 
         * the pot file
         */
        renderTemplateGetSubIdeasLabel: function(subIdeas){
            if(subIdeas.length == 0) {
                return i18n.gettext('This idea has no sub-ideas');
            }
            else {
                return i18n.sprintf(i18n.ngettext('This idea has %d sub-idea','This idea has %d sub-ideas',subIdeas.length), subIdeas.length);
            }
        },
        /**
         * This is not inside the template beacuse babel wouldn't extract it in 
         * the pot file
         */
        renderTemplateGetExtractsLabel: function(extracts){
            if(extracts.length == 0) {
                return i18n.gettext('No extracts were harvested for this idea');
            }
            else {
                return i18n.sprintf(i18n.ngettext('Harvested in %d extract','Harvested in %d extracts',extracts.length), extracts.length);
            }
        },
        /**
         * The render
         */
        render: function(){
            if(Ctx.debugRender) {
                console.log("ideaPanel:render() is firing");
            }

            var that = this,
            segments = {},
            subIdeas = {},
            votable_widgets = [],
            currentUser = Ctx.getCurrentUser(),
            canEdit = currentUser.can(Permissions.EDIT_IDEA) || false,
            canEditNextSynthesis = currentUser.can(Permissions.EDIT_SYNTHESIS),
            collectionManager = new CollectionManager();

            Ctx.cleanTooltips(this.$el);
            
            collectionManager.getAllExtractsCollectionPromise().done(
            function(allExtractsCollection) {
            var extracts = [];
              if(that.model) {
                subIdeas = that.model.getChildren();
                votable_widgets = that.model.getVotableOnWhichWidgets();
                extracts = allExtractsCollection.where({idIdea:that.model.id});
            }

            that.$el.html( that.template( {
                idea : that.model,
                segments : extracts,
                subIdeas : subIdeas,
                votable_widgets : votable_widgets,
                canEdit : canEdit,
                i18n : i18n,
                renderTemplateGetExtractsLabel : that.renderTemplateGetExtractsLabel,
                renderTemplateGetSubIdeasLabel : that.renderTemplateGetSubIdeasLabel,
                canDelete : currentUser.can(Permissions.EDIT_IDEA),
                canEditNextSynthesis : canEditNextSynthesis,
                canEditExtracts : currentUser.can(Permissions.EDIT_EXTRACT),
                canEditMyExtracts : currentUser.can(Permissions.EDIT_MY_EXTRACT),
                canAddExtracts : currentUser.can(Permissions.EDIT_EXTRACT), //TODO: This is a bit too coarse
                canCreateWidgets : currentUser.can(Permissions.ADMIN_DISCUSSION)
            } ) );

            if(that.model) {
              
              $.when( collectionManager.getAllUsersCollectionPromise(),
                      collectionManager.getAllMessageStructureCollectionPromise()
                      ).then(
                          function( allUsersCollection, allMessagesCollection) {
                            
                    /* We need a real view for that benoitg - 2014-07-23 */
                    var ideaExtractList = that.$('.postitlist'),
                        template = Ctx.loadTemplate('segment');
                    
                    _.each(extracts, function(extract) {
                      var post = allMessagesCollection.get(extract.get('idPost'));
                      ideaExtractList.append( template(
                          {segment: extract,
                           post: post,
                           postCreator: allUsersCollection.get(post.get('idCreator')),
                           canEditExtracts : currentUser.can(Permissions.EDIT_EXTRACT),
                           canEditMyExtracts : currentUser.can(Permissions.EDIT_MY_EXTRACT),
                           ctx : Ctx
                          }) );
                    });
                  }
              );
            }

            Ctx.initTooltips(that.$el);
            that.panel = that.$('.panel');
            Ctx.initClipboard();
            if(that.model) {
            var shortTitleField = new EditableField({
                'model': that.model,
                'modelProp': 'shortTitle',
                'class': 'panel-editablearea text-bold',
                'data-tooltip': i18n.gettext('Short expression (only a few words) of the idea in the table of ideas.'),
                'placeholder': i18n.gettext('New idea'),
                'canEdit': canEdit
            });
            shortTitleField.renderTo(that.$('#ideaPanel-shorttitle'));



            that.longTitleField = new CKEditorField({
                'model': that.model,
                'modelProp': 'longTitle',
                'placeholder': that.model.getLongTitleDisplayText(),
                'canEdit': canEditNextSynthesis
            });
            that.longTitleField.renderTo( that.$('#ideaPanel-longtitle'));
            
            that.definitionField = new CKEditorField({
                'model': that.model,
                'modelProp': 'definition',
                'placeholder': that.model.getDefinitionDisplayText(),
                'canEdit': canEdit
            });
            that.definitionField.renderTo( that.$('#ideaPanel-definition'));

            that.commentView = new MessageSendView({
                'allow_setting_subject': false,
                'reply_idea': that.model,
                'body_help_message': i18n.gettext('Comment on this idea here...'),
                'send_button_label': i18n.gettext('Send your comment'),
                'subject_label': null,
                'mandatory_body_missing_msg': i18n.gettext('You need to type a comment first...'),
                'mandatory_subject_missing_msg': null
            });
            that.$('#ideaPanel-comment').append( that.commentView.render().el );
            }
            });
            return this;
        },

        /**
         * Blocks the panel
         */
        blockPanel: function(){
            this.$('.panel').addClass('is-loading');
        },

        /**
         * Unblocks the panel
         */
        unblockPanel: function(){
            this.$('.panel').removeClass('is-loading');
        },

        /**
         * Add a segment
         * @param  {Segment} segment
         */
        addSegment: function(segment){
            delete segment.attributes.highlights;

            var id = this.model.getId();
            segment.save('idIdea', id);
        },

        /**
         * Shows the given segment with an small fx
         * @param {Segment} segment
         */
        showSegment: function(segment){
            var that = this,
                selector = Ctx.format('.box[data-segmentid={0}]', segment.cid),
                idIdea = segment.get('idIdea'),
                box,
                collectionManager = new CollectionManager();

                collectionManager.getAllIdeasCollectionPromise().done(
                    function(allIdeasCollection) {
                      var idea = allIdeasCollection.get(idIdea);
                      if( !idea ){
                        return;
                      }

                      that.setIdeaModel(idea);
                      box = that.$(selector);

                      if( box.length ){
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

        /**
         * Set the given idea as the current one
         * @param  {Idea} [idea=null]
         */
        setIdeaModel: function(idea){
            var that = this,
            ideaChangeCallback = function() {
                //console.log("setCurrentIdea:ideaChangeCallback fired");
                that.render();
            };
            if( idea !== this.model ){
                if( this.model !== null ) {
                    this.stopListening(this.model, 'change', ideaChangeCallback);
                }
                this.model = idea;
                if( this.model !== null ){
                    //console.log("setCurrentIdea:  setting up new listeners for "+this.model.id);
                    this.listenTo(this.model, 'change', ideaChangeCallback);
                    Ctx.openPanel(assembl.ideaPanel);
                } else {
                    //TODO: More sophisticated behaviour here, depending 
                    //on if the panel was opened by selection, or by something else.
                    //app.closePanel(app.ideaPanel);
                }
                this.render();
            }
        },

        /**
         * Delete the current idea
         */
        deleteCurrentIdea: function(){
            // to be deleted, an idea cannot have any children nor segments
            var children = this.model.getChildren(),
                segments = this.model.getSegmentsDEPRECATED(),
                that = this;

            if( children.length > 0 ){
                return alert( i18n.gettext('ideaPanel-cantDeleteByChildren') );
            }

            // Nor has any segments
            if( segments.length > 0 ){
                return alert( i18n.gettext('ideaPanel-cantDeleteBySegments') );
            }

            // That's a bingo
            this.blockPanel();
            this.model.destroy({ success: function(){
                that.unblockPanel();
                Ctx.setCurrentIdea(null);
            }});
        },

        /**
         * Events
         */
        events: {
            'dragstart .box': 'onDragStart',
            'dragend .box': "onDragEnd",
            'dragover .panel': 'onDragOver',
            'dragleave .panel': 'onDragLeave',
            'drop .panel': 'onDrop',

            'click .closebutton': 'onSegmentCloseButtonClick',
            'click #ideaPanel-clearbutton': 'onClearAllClick',
            'click #ideaPanel-closebutton': 'onTopCloseButtonClick',
            'click #ideaPanel-deleteButton': 'onDeleteButtonClick',

            'click .segment-link': "onSegmentLinkClick",
            'click #session-modal': "createWidgetSession"
        },

        createWidgetSession: function(){

            if(this.model){

                var data = {
                    type: 'CreativityWidget',
                    settings: JSON.stringify({
                       "idea": this.model.attributes['@id']
                    })
                }


                var notification =  new Notification();

                notification.openSession(null, {view:'edit'});

                return;

                Backbone.ajax({
                   type:'POST',
                   url:'/data/Discussion/'+ Assembl.getDiscussionId() +'/widgets',
                   data: $.param(data),
                   success: function(data, textStatus, jqXHR){

                       //TODO: add config receive
                       notification.openSession(null, {view:'edit'});

                   },
                   errors: function(jqXHR, textStatus, errorThrown){


                   }
                })
            }

        },

        /**
         * @event
         */
        onDragStart: function(ev){
          var that = this,
              collectionManager = new CollectionManager();
            //TODO: Deal with editing own extract (EDIT_MY_EXTRACT)
          collectionManager.getAllExtractsCollectionPromise().done(
              function(allExtractsCollection) {
                if(Ctx.getCurrentUser().can(Permissions.EDIT_EXTRACT)){
                  ev.currentTarget.style.opacity = 0.4;

                  var cid = ev.currentTarget.getAttribute('data-segmentid'),
                      segment = allExtractsCollection.getByCid(cid);
                  console.log( cid );
                  Ctx.showDragbox(ev, segment.getQuote());
                  Ctx.draggedSegment = segment;
                }
              });
           
        },

        /**
         * @event
         */
        onDragEnd: function(ev){
            ev.currentTarget.style.opacity = '';
            Ctx.draggedSegment = null;
        },

        /**
         * @event
         */
        onDragOver: function(ev){
            //console.log("ideaPanel:onDragOver() fired");
            ev.preventDefault();
            if( Ctx.draggedSegment !== null || Ctx.draggedAnnotation !== null){
                this.panel.addClass("is-dragover");
            }
        },

        /**
         * @event
         */
        onDragLeave: function(){
            //console.log("ideaPanel:onDragLeave() fired");
            this.panel.removeClass('is-dragover');
        },

        /**
         * @event
         */
        onDrop: function(ev){
            //console.log("ideaPanel:onDrop() fired");
            if( ev ){
                ev.preventDefault();
                ev.stopPropagation();
            }

            this.panel.trigger('dragleave');

            var segment = Ctx.getDraggedSegment();
            if( segment ){
                this.addSegment(segment);
            }
            var annotation = Ctx.getDraggedAnnotation();
            if( annotation ){
                // Add as a segment
                Ctx.currentAnnotationIdIdea = this.model.getId();
                Ctx.currentAnnotationNewIdeaParentIdea = null;
                Ctx.saveCurrentAnnotationAsExtract();
                return;
            }

        },

        /**
         * @event
         */
        onSegmentCloseButtonClick: function(ev){
          var that = this,
              cid = ev.currentTarget.getAttribute('data-segmentid'),
              collectionManager = new CollectionManager();
          collectionManager.getAllExtractsCollectionPromise().done(
              function(allExtractsCollection) {
                var segment = allExtractsCollection.get(cid);
                
                if( segment ){
                  segment.save('idIdea', null);
                }
              });
        },

        /**
         * @event
         */
        onClearAllClick: function(ev){
            var ok = confirm( i18n.gettext('ideaPanel-clearConfirmationMessage') );
            if( ok ){
                this.model.get('segments').reset();
            }
        },
        /**
         * Closes the panel
         */
        closePanel: function(){
            if(this.button){
                this.button.trigger('click');
            }
        },
        /**
         * @event
         */
        onTopCloseButtonClick: function(){
            this.closePanel();
        },

        /**
         * @event
         */
        onDeleteButtonClick: function(){
            var ok = confirm( i18n.gettext('ideaPanel-deleteIdeaConfirmMessage') );

            if(ok){
                this.deleteCurrentIdea();
            }
        },

        /**
         * @event
         */
        onSegmentLinkClick: function(ev){
          var cid = ev.currentTarget.getAttribute('data-segmentid'),
              collectionManager = new CollectionManager();
          
          collectionManager.getAllExtractsCollectionPromise().done(
              function(allExtractsCollection) {
                var segment = allExtractsCollection.get(cid);
                Ctx.showTargetBySegment(segment);
              });
        }

    });

    return IdeaPanel;
});
