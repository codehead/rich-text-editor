const util = require('./util')
const sanitizeHtml = require('sanitize-html')
const sanitizeOpts = require('./sanitizeOpts')
const toolbars = require('./toolbars')
const MQ = MathQuill.getInterface(2)
const locales = {
    FI: require('./FI'),
    SV: require('./SV')
}
const l = locales[window.locale].editor
const keyCodes = {
    ENTER: 13,
    ESC: 27
}

let $toolbar
const $outerPlaceholder = $(`<div class="outerPlaceholder hidden">`)
let mathEditor

function moveElementAfter($element, $after) {
    $after.after($element)
}

function hideElementInDOM($element) {
    $outerPlaceholder.append($element)
}

let editor

window.onload = () => {
    // TODO: replace with data attributes?
    let answerFocus = true
    let latexEditorFocus = false
    let equationEditorFocus = false
    let mathEditorVisible = false
    let $editor

    $('body').append($outerPlaceholder)

    mathEditor = initMathEditor()
    initToolbar()

    function initMathEditor() {
        const $mathEditor = $(`
            <div class="math">
                <div class="close" title="Ctrl-Enter">${l.close}</div>
                <div class="boxes">
                    <div class="equationEditor"></div>
                    <textarea class="latexEditor" placeholder="LaTex"></textarea>
                </div>
            </div>`)

        hideElementInDOM($mathEditor)

        const $latexEditor = $mathEditor.find('.latexEditor')
        const $equationEditor = $mathEditor.find('.equationEditor')
        const mathField = MQ.MathField($equationEditor.get(0), {
            handlers: {
                edit: () => !latexEditorFocus && $latexEditor.val(mathField.latex()),
                enter: field => {
                    // TODO: do not close editor / o not create a new equation if there is no text?
                    mathEditor.closeMathEditor(true)
                    setTimeout(() => insertNewEquation('<div></div>'), 2)
                }
            }
        })

        $equationEditor
            .on('focus mousedown', e => equationEditorFocus = true)
            .on('focus blur', '.mq-textarea textarea', e => {
                equationEditorFocus = e.type !== 'blur'
                onFocusChanged()
            })

        function onLatexUpdate() {
            setTimeout(() => mathField.latex($latexEditor.val()), 1)
        }

        $latexEditor
            .keyup(onLatexUpdate)
            .on('focus blur', e => {
                latexEditorFocus = e.type !== 'blur'
                onFocusChanged()
            })

        $mathEditor.find('.close').mousedown(e => {
            e.preventDefault()
            closeMathEditor(true)
        })

        let focusChanged = null

        function onFocusChanged() {
            clearTimeout(focusChanged)
            focusChanged = setTimeout(() => {
                if (!latexEditorFocus && !equationEditorFocus) closeMathEditor()
                if (!answerFocus && !mathEditorVisible && !latexEditorFocus && !equationEditorFocus) closeEditor()
            }, 0)

        }

        function insertNewEquation(optionalMarkup) {
            window.document.execCommand('insertHTML', false, (optionalMarkup ? optionalMarkup : '') + '<img class="result new" style="display: none"/>');
            const $addedEquationImage = $('.result.new')
            $addedEquationImage
                .removeClass('new')

            moveElementAfter($mathEditor, $addedEquationImage)

            mathField.latex('')
            mathEditorVisible = true
            $toolbar.find('.newEquation').hide()
            $toolbar.find('.mathToolbar').show()
            setTimeout(() => mathField.focus(), 0)
        }

        function insertMath(symbol, alternativeSymbol, useWrite) {
            if (latexEditorFocus) {
                util.insertToTextAreaAtCursor($latexEditor.get(0), alternativeSymbol || symbol)
                onLatexUpdate()
            } else if (equationEditorFocus) {
                if (useWrite) {
                    mathField.write(symbol)
                } else {
                    mathField.typedText(symbol)
                }

                if (symbol.startsWith('\\')) mathField.keystroke('Tab')
                setTimeout(() => mathField.focus(), 0)
            }
        }

        function closeMathEditor(setFocusAfterClose = false) {
            // TODO: remove event bindings
            const $currentEditor = $mathEditor.closest('.answer')
            const $img = $mathEditor.prev()
            if ($latexEditor.val().trim() === '') {
                $img.remove()
            } else {
                $img.show()
                    .prop('src', '/math.svg?latex=' + encodeURIComponent($latexEditor.val()))
                    .prop('alt', $latexEditor.val())
            }

            $toolbar.find('.newEquation').show()
            $toolbar.find('.mathToolbar').hide()
            hideElementInDOM($mathEditor)
            mathEditorVisible = false
            latexEditorFocus = false
            equationEditorFocus = false
            if (setFocusAfterClose) $currentEditor.focus()
        }

        function openMathEditor($img) {
            if (mathEditorVisible) closeMathEditor()
            $img.hide()
            moveElementAfter($mathEditor, $img)
            const latex = $img.prop('alt')
            $latexEditor.val(latex)
            onLatexUpdate()
            mathEditorVisible = true
            $toolbar.find('.newEquation').hide()
            $toolbar.find('.mathToolbar').show()
            setTimeout(() => mathField.focus(), 0)
        }

        return {
            insertNewEquation,
            insertMath,
            closeMathEditor,
            openMathEditor,
            onFocusChanged
        }
    }

    function initToolbar() {
        $toolbar = $(`        
        <div class="toolbar">
            <div class="characters">
                <span class="special-characters">
                  <div class="list"></div>
                </span>
            </div>
            <div class="mathToolbar list hidden"></div>
            <p>
                <button class="newEquation actionButton" title="Ctrl-L">${l.insertEquation}</button>
            </p>
        </div>
        `)

        hideElementInDOM($toolbar)

        const hasAnswerFocus = () => answerFocus
        toolbars.initSpecialCharacterToolbar($toolbar, mathEditor, hasAnswerFocus)
        toolbars.initMathToolbar($toolbar, mathEditor)
        toolbars.initNewEquation($toolbar, mathEditor, hasAnswerFocus)
    }

    function openEditor($element) {
        $editor = $element
        $element.before($toolbar)
        $toolbar.show()
    }

    function closeEditor() {
        // TODO: remove event bindings
        $toolbar.find('.mathToolbar').hide()
        hideElementInDOM($toolbar)
        mathEditor.closeMathEditor()
        // $editor.off()

        answerFocus = false
        mathEditorVisible = false
        latexEditorFocus = false
    }

    let blurred

    function onEditorFocusChanged(e) {
        answerFocus = e.type === 'focus'

        clearTimeout(blurred)
        blurred = setTimeout(() => {
            if (!answerFocus && !mathEditorVisible && !latexEditorFocus && !equationEditorFocus) closeEditor()
            else if (answerFocus && mathEditorVisible) mathEditor.closeMathEditor()
            else openEditor($(e.target))
        }, 0)
    }

    function isMathEditorVisible() {
        return mathEditorVisible
    }

    editor = {
        openEditor,
        closeEditor,
        onEditorFocusChanged,
        isMathEditorVisible,
        openMathEditor: mathEditor.openMathEditor,
        closeMathEditor: mathEditor.closeMathEditor,
        insertNewEquation: mathEditor.insertNewEquation
    }
}

const markAndGetInlineImages = $editor => $editor.find('img[src^="data"]')
    .each((i, el) => el.setAttribute('id', new Date().getTime() + '-' + i))
    .map((i, el) => ({data: el.getAttribute('src'), id: el.getAttribute('id')}))
    .toArray()

const persistInlineImages = $editor => {
    return Bacon.combineAsArray(
        markAndGetInlineImages($editor)
            .map(data =>
                Bacon.fromPromise(
                    $.post({
                        url: '/saveImg',
                        data: {
                            text: data.data,
                            id: data.id,
                            answerId: $editor.attr('id')
                        }
                    }))))
        .flatMap(results => {
            results.forEach(id => {
                $editor.find('#' + id).attr('src', `/loadImg?answerId=${$editor.attr('id')}&id=${id}`)
            })
        })
        .onValue(() => $editor.trigger('input'))
}

const makeRichText = (selector, onValueChanged = () => { }) => {
    $(selector).each((i, element) => {
        const $answer = $(element)
        $answer
            .attr('contenteditable', 'true')
            .attr('data-js-handle', 'answer')
            .on('keydown', e => {
                if (isCtrlKey(e, keyCodes.ENTER) || isKey(e, keyCodes.ESC)) mathEditor.closeMathEditor(true)
            })
            .on('mousedown', '.result', e => editor.openMathEditor($(e.target))) // TODO: open editor if clicked on equation in another editor
            .on('keypress', e => {
                if (isCtrlKey(e, 'l') || isCtrlKey(e, 'i')) editor.insertNewEquation()
            })
            .on('focus blur', e => {
                if (editor.isMathEditorVisible() && e.type === 'focus') editor.closeMathEditor()
                editor.onEditorFocusChanged(e)
            })
            .on('input focus', e => onValueChanged($(e.currentTarget)))
            .on('paste', e => {
                if (e.target.tagName === 'TEXTAREA')
                    return
                const reader = new FileReader()
                const clipboardData = e.originalEvent.clipboardData
                const file = clipboardData.items && clipboardData.items[0].getAsFile()
                if (file) {
                    e.preventDefault()
                    reader.readAsDataURL(file)
                } else {
                    const clipboardDataAsHtml = clipboardData.getData('text/html')
                    if (clipboardDataAsHtml) {
                        e.preventDefault()
                        window.document.execCommand('insertHTML', false, sanitizeHtml(clipboardDataAsHtml, sanitizeOpts));
                        persistInlineImages($answer)
                        // TODO: call autosave?
                    }
                }

                reader.onload = evt => {
                    const img = `<img src="${evt.target.result}"/>`
                    window.document.execCommand('insertHTML', false, sanitizeHtml(img, sanitizeOpts))
                    persistInlineImages($answer)
                    // TODO: call autosave?
                }
            })
    })
}

function isKey(e, key) { return !e.altKey && !e.shiftKey && !e.ctrlKey  && keyOrKeyCode(e, key)}

function isCtrlKey(e, key) { return !e.altKey && !e.shiftKey && e.ctrlKey && keyOrKeyCode(e, key)}

function keyOrKeyCode(e, val) { return typeof val === 'string' ? e.key === val : e.keyCode === val }

module.exports = {
    makeRichText
}
