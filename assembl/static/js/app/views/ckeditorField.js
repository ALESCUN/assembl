'use strict';

define(['backbone.marionette', 'app' , 'underscore', 'common/context', 'ckeditor-sharedspace', 'jquery'],
    function (Marionette, Assembl, _, Ctx, ckeditor, $) {


        var cKEditorField = Marionette.ItemView.extend({
            template: '#tmpl-ckeditorField',
            /**
             * Ckeditor default configuration
             * @type {object}
             */
            CKEDITOR_CONFIG: {
                toolbar: [
                    ['Bold', 'Italic', 'Outdent', 'Indent', 'NumberedList', 'BulletedList'],
                    ['Link', 'Unlink', 'Anchor']
                ],
                extraPlugins: 'sharedspace',
                removePlugins: 'floatingspace,resize',
                sharedSpaces: { top: 'ckeditor-toptoolbar', bottom: 'ckeditor-bottomtoolbar' }
            },

            ckInstance: null,

            showPlaceholderOnEditIfEmpty: false,

            initialize: function (options) {
                this.view = this;

                this.topId = _.uniqueId('ckeditorField-topid');
                this.fieldId = _.uniqueId('ckeditorField');
                this.bottomId = _.uniqueId('ckeditorField-bottomid');

                (this.editing) ? this.editing = true : this.editing = false;

                (_.has(options, 'modelProp')) ? this.modelProp = options.modelProp : this.modelProp = null;

                (_.has(options, 'placeholder')) ? this.placeholder = options.placeholder : this.placeholder = null;

                (_.has(options, 'showPlaceholderOnEditIfEmpty')) ? this.showPlaceholderOnEditIfEmpty = options.showPlaceholderOnEditIfEmpty : this.showPlaceholderOnEditIfEmpty = null;

                (_.has(options, 'canEdit')) ? this.canEdit = options.canEdit : this.canEdit = true;

                if (this.model === null) {
                    throw new Error('EditableField needs a model');
                }

                this.listenTo(this.view, 'cKEditorField:render', this.render);
            },

            ui: {
                mainfield: '.ckeditorField-mainfield',
                saveButton: '.ckeditorField-savebtn',
                cancelButton: '.ckeditorField-cancelbtn'
            },

            events: {
                'click @ui.mainfield': 'changeToEditMode',
                'click @ui.saveButton': 'saveEdition',
                'click @ui.cancelButton': 'cancelEdition'
            },

            serializeData: function () {
                var textToShow = null;

                if (this.showPlaceholderOnEditIfEmpty) {
                    textToShow = this.placeholder;
                }
                else {
                    textToShow = this.model.get(this.modelProp);
                }

                return {
                    topId: this.topId,
                    fieldId: this.fieldId,
                    bottomId: this.bottomId,
                    text: textToShow,
                    editing: this.editing,
                    canEdit: this.canEdit,
                    placeholder: this.placeholder
                }
            },

            onRender: function () {
                this.destroy();
                if (this.editing) {
                    this.startEditing();
                }
            },

            /**
             * set the templace in editing mode
             */
            startEditing: function () {
                var editingArea = this.$('#' + this.fieldId).get(0);

                var config = _.extend({}, this.CKEDITOR_CONFIG, {
                    sharedSpaces: { top: this.topId, bottom: this.bottomId }
                });

                this.ckInstance = ckeditor.inline(editingArea, config);
                window.setTimeout(function () {
                    editingArea.focus();
                }, 100);
                /*
                 We do not enable save on blur, because:
                 - we have a Save and a Cancel button
                 - the save on blur feature until now was called even when the user clicked on Save or Cancel button, so the content was saved anyway and the buttons were useless
                 - an editor may blur by mistake (which saves new content) but maybe he wanted to revert his changes afterwards

                 this.ckInstance.element.on('blur', function () {

                 // Firefox triggers the blur event if we paste (ctrl+v)
                 // in the ckeditor, so instead of calling the function directly
                 // we wait to see if the focus is still in the ckeditor
                 setTimeout(function () {
                 if (!that.ckInstance.element) {
                 return;
                 }

                 var hasFocus = $(that.ckInstance.element).is(":focus");
                 if (!hasFocus) {
                 that.saveEdition();
                 }
                 }, 100);

                 });
                 */
            },

            /**
             * Renders inside the given jquery or HTML elemenent given
             * @param {jQuery|HTMLElement} el
             * @param {Boolean} editing
             */
            renderTo: function (el, editing) {
                this.editing = editing;
                $(el).append(this.$el);
                this.view.trigger('cKEditorField:render');
            },

            /**
             * Destroy the ckeditor instance
             */
            destroy: function () {
                //FIXME: need this ?
                /*if (this.ckInstance) {
                 this.ckInstance.destroy();
                 } */

                this.ckInstance = null;
            },

            changeToEditMode: function () {
                if (this.canEdit) {
                    this.editing = true;
                    this.view.trigger('cKEditorField:render');
                }
            },

            saveEdition: function (ev) {
                if (ev) {
                    ev.stopPropagation();
                }

                var text = this.ckInstance.getData();
                text = $.trim(text);
                if (text != this.placeholder || text == '') {
                    /* We never save placeholder values to the model */
                    if (this.model.get(this.modelProp) != text) {
                        /* Nor save to the database and fire change events
                         * if the value didn't change from the model
                         */
                        this.model.save(this.modelProp, text, {
                            success: function (model, resp) {
                            },
                            error: function (model, resp) {
                                console.error('ERROR: saveEdition', resp);
                            }
                        });
                        this.trigger('save', [this]);
                    }
                }
                this.editing = false;
                this.view.trigger('cKEditorField:render');
            },

            cancelEdition: function (ev) {
                if (ev) {
                    ev.stopPropagation();
                }

                if (this.ckInstance) {
                    var text = this.model.get(this.modelProp);
                    this.ckInstance.setData(text);
                }

                this.editing = false;
                this.view.trigger('cKEditorField:render');

                this.trigger('cancel', [this]);
            }

        });


        return cKEditorField;
    });
