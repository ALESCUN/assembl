'use strict';

define(['backbone.marionette', 'app','jquery', 'common/collectionManager', 'common/context', 'utils/i18n', 'backbone.modal', 'backbone.marionette.modals', 'models/partners'],
    function (Marionette, Assembl, $, CollectionManager, Ctx, i18n, backboneModal, marionetteModal, partnerModel) {

        var Partners = Marionette.ItemView.extend({
            template: '#tmpl-partnersInAdmin',
            className: 'gr',
            ui: {
              'partnerItem':'.js_deletePartner',
              'partnerItemEdit': '.js_editPartner'
            },
            events: {
                'click @ui.partnerItem':'deletePartner',
                'click @ui.partnerItemEdit': 'editPartner'
            },
            serializeData: function(){
                return {
                    partner: this.model
                }
            },
            deletePartner: function(){
               var that = this;
               this.model.destroy({
                  success: function(){
                     that.$el.fadeOut();
                  },
                  error: function(){

                  }
               });
            },
            editPartner: function(){
                var self = this;

                var Modal = Backbone.Modal.extend({
                    template: _.template($('#tmpl-adminPartnerEditForm').html()),
                    className: 'partner-modal popin-wrapper',
                    cancelEl: '.close, .js_close',
                    keyControl: false,
                    model: self.model,
                    initialize: function () {
                        this.$('.bbm-modal').addClass('popin');
                    },
                    events: {
                        'click .js_validatePartner' :'validatePartner'
                    },
                    validatePartner: function (e) {

                        var that = this,
                            validForm = false,
                            name_mandatory = this.$('.partner-name'),
                            description_mandatory = this.$('.partner-description'),
                            website = this.$('.partner-homepage'),
                            url_logo = this.$('.partner-logo'),
                            regexUrl = /^(http|https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
                            parent = name_mandatory.parent().parent(),
                            p_website = website.parent().parent(),
                            p_url_logo = url_logo.parent().parent(),
                            p_description_mandatory = description_mandatory.parent().parent(),
                            controls = document.querySelectorAll('#partner-form .control-group');

                        if(name_mandatory.val() === ''){
                            validForm = false;
                            parent.addClass('error');
                            return false;
                        } else {
                            validForm = true;
                            parent.removeClass('error');
                        }

                        if(p_description_mandatory.val() === ''){
                            validForm = false;
                            p_description_mandatory.addClass('error');
                            return false;
                        } else {
                            validForm = true;
                            p_description_mandatory.removeClass('error');
                        }

                        if(website.val()){
                            if (!regexUrl.test(website.val())) {
                                p_website.addClass('error');
                                validForm = false;
                                return false;
                            } else {
                                validForm = true;
                                p_website.removeClass('error');
                            }
                        }

                        if(url_logo.val()){
                            if (!regexUrl.test(url_logo.val())) {
                                p_url_logo.addClass('error');
                                validForm = false;
                                return false;
                            } else {
                                validForm = true;
                                p_url_logo.removeClass('error');
                            }
                        }

                        if(validForm){
                            $(controls).removeClass('success');

                            self.model.set({
                                description: this.$('.partner-description').val(),
                                homepage: this.$('.partner-homepage').val(),
                                logo: this.$('.partner-logo').val(),
                                name: this.$('.partner-name').val(),
                                is_initiator: (this.$('.partner-initiator:checked').val()) ? true : false
                            });

                            self.model.save(null, {
                                success: function(model, resp){
                                    self.render();
                                    that.triggerSubmit();
                                },
                                error: function(model, resp){
                                    console.log(resp)
                                }
                            })

                        }

                    }
                });

                var modal = new Modal();

                Assembl.slider.show(modal);

            }
        });

        var PartnerList = Marionette.CollectionView.extend({
            childView: Partners,
            initialize: function(){
                var that = this,
                    collectionManager = new CollectionManager();

                this.collection = undefined;

                $.when(collectionManager.getAllPartnerOrganizationCollectionPromise()).then(
                    function (allPartnerOrganization) {
                        that.collection = allPartnerOrganization;
                        that.render();
                    });
            }
        });

        var adminPartners = Marionette.LayoutView.extend({
            template: '#tmpl-adminPartners',
            className: 'admin-notifications',
            ui: {
              partners: '.js_addPartner',
              close: '.bx-alert-success .bx-close'
            },

            regions: {
              partner: '#partner-content'
            },

            events: {
                'click @ui.partners': 'addNewPartner',
                'click @ui.close': 'close'
            },

            serializeData: function () {
                return {
                    Ctx: Ctx
                }
            },

            onRender: function () {
                Ctx.initTooltips(this.$el);

                var partnerList = new PartnerList();

                this.partner.show(partnerList);
            },

            close: function () {
                this.$('.bx-alert-success').addClass('hidden');
            },

            addNewPartner: function(){
                var self = this;

                var Modal = Backbone.Modal.extend({
                    template: _.template($('#tmpl-adminPartnerForm').html()),
                    className: 'partner-modal popin-wrapper',
                    cancelEl: '.close, .js_close',
                    keyControl: false,
                    initialize: function () {
                        this.$('.bbm-modal').addClass('popin');
                    },
                    events: {
                     'click .js_validatePartner' :'validatePartner'
                    },
                    validatePartner: function (e) {

                        var that = this,
                            validForm = false,
                            name_mandatory = this.$('.partner-name'),
                            description_mandatory = this.$('.partner-description'),
                            website = this.$('.partner-homepage'),
                            url_logo = this.$('.partner-logo'),
                            regexUrl = /^(http|https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
                            parent = name_mandatory.parent().parent(),
                            p_website = website.parent().parent(),
                            p_url_logo = url_logo.parent().parent(),
                            p_description_mandatory = description_mandatory.parent().parent(),
                            controls = document.querySelectorAll('#partner-form .control-group');

                        if(name_mandatory.val() === ''){
                            parent.addClass('error');
                            validForm = false;
                            return false;
                        } else {
                            validForm = true;
                            parent.removeClass('error');
                        }

                        if(p_description_mandatory.val() === ''){
                            validForm = false;
                            p_description_mandatory.addClass('error');
                            return false;
                        } else {
                            validForm = true;
                            p_description_mandatory.removeClass('error');
                        }

                        if(website.val()){
                            if (!regexUrl.test(website.val())) {
                                p_website.addClass('error');
                                validForm = false;
                                return false;
                            } else {
                                validForm = true;
                                p_website.removeClass('error');
                            }
                        }

                        if(url_logo.val()){
                            if (!regexUrl.test(url_logo.val())) {
                                p_url_logo.addClass('error');
                                validForm = false;
                                return false;
                            } else {
                                validForm = true;
                                p_url_logo.removeClass('error');
                            }
                        }


                        if(validForm){
                            var inputs = document.querySelectorAll('#partner-form *[required=required]');
                            $(controls).removeClass('success');

                            var partner = new partnerModel.Model({
                                description: this.$('.partner-description').val(),
                                homepage: this.$('.partner-homepage').val(),
                                logo: this.$('.partner-logo').val(),
                                name: this.$('.partner-name').val(),
                                is_initiator: (this.$('.partner-initiator:checked').val()) ? true : false
                            });

                            partner.save(null, {
                                success: function(model, resp){
                                    $(inputs).val('');
                                    self.render();
                                    that.triggerSubmit();
                                },
                                error: function(model, resp){
                                    console.log(resp)
                                }
                            })

                        }

                    }
                });

                var modal = new Modal();

                Assembl.slider.show(modal);

            }


        });

        return adminPartners;
    });