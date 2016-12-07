const express = require('express');
const router = express.Router();

const datamuse = require('datamuse');
const syllable = require('syllable');
const _ = require('lodash');

// Start up rhyming cache
const NodeCache = require("node-cache");
const myCache = new NodeCache();

const SIMILAR_SCORE_CONSTANT = 500;
const debug = false;

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Rhyme Time' });
});

router.post('/rhyme', function (req, res, next) {
    let originalText = req.body.originalText;
    new Poem(originalText, (error, result) => {
        // Replace all newlines with linebreak
        let originalTextFormat = originalText.replace(/\n/g, '<br>');
        let resultFormat = result.replace(/\n/g, '<br>');
        res.render('result', {title: 'Rhyme Result', original: originalTextFormat, result: resultFormat});
    });
});

class Poem {

    constructor(text, cb) {
        this.wordsDone = []; // Keeps track of rhyming words we have found to prevent duplicates

        this.modifyText(text, cb);
    }

    modifyText(text, cb) {
        let lines = _.split(text.trim(), '\n');
        for (let i = 0; i < lines.length; i++) {
            let line = _.trim(lines[i], '\n\r\t\f '); // Strip random stuff
            lines[i] = line; // Then save stripped line in final version
            if (/\S/.test(line)) { // Make sure line isn't empty or whitespace, and preserve the styling by not modifying
                let words = _.split(line, ' ');
                let lastWord = words[words.length - 1].replace(/[^\w]/g,''); // Want to rhyme last word

                this.getRhymeFor(lastWord, (error, word) => {
                    if (error) { // An error occurred when getting a rhyme, so don't change word
                        word = lastWord;
                        if (debug)
                            console.log("ERROR:", error);
                    } else {
                        if (debug)
                            console.log("Found rhyme for", lastWord, ":", word, "at index:", i);
                    }

                    // Now rejoin line and replace for final text
                    words[words.length - 1] = word;
                    lines[i] = _.join(words, ' ');

                    this.wordsDone.push(word); // Add word to done so we can parallel done and no duplicates
                    if (this.wordsDone.length == lines.length) {
                        cb(false, _.join(lines, '\n'));
                    }
                });
            } else {
                if (debug)
                    console.log("Skipping line:", i);
                this.wordsDone.push(line);
            }
        }
    }

    getRhymeFor(word, cb) {
        let wordSyl = syllable(word);
        let poem = this;
        myCache.get(word, function( err, value ) {
            if (!err) { // Make sure no caching error
                if (value == undefined) { // Word is not cached, so get manually
                    datamuse.words({
                        rel_rhy: word
                    }).then((json) => {
                        // Cache the rhyme response from datamuse for a given word
                        myCache.set(word, json);
                        // Filter and select a rhyme
                        let rhymes = poem.filterRhymes(json, wordSyl);
                        poem.selectRandomRhyme(rhymes, word, cb);
                    }).catch(error => {
                        // TODO make server report error in api request, like api is down so we can't work right now
                        // TODO: log(error.response.body);
                        if (debug)
                            console.log("ERROR occured with rhyme request: ", error);
                        cb("API GET request error");
                    });
                } else {
                    // Filter and select a rhyme
                    let rhymes = poem.filterRhymes(value, wordSyl);
                    poem.selectRandomRhyme(rhymes, word, cb);
                }
            } else {
                cb("Caching error: " + err);
            }
        });
    }

    selectRandomRhyme(rhymes, word, cb) {
        // Determine if we actually found at least one rhyme
        if (rhymes) {
            let randIndex = getRandomInt(0, rhymes.length);
            cb(false, rhymes[randIndex].word);
        } else { // We failed to find a rhyme with/out same syllables and >= SIMILAR_SCORE_CONSTANT
            if (myCache.get(word).length > 0) { // Mark failed word to negate any unnecessary filtering of junk in the future
                myCache.set(word, []);
            }
            cb("Unable to find appropriate rhyme for '" + word + "'");
        }
    }

    filterRhymes(rawRhymes, wordSyl, syllable=true) {
        let rhymes = _.filter(rawRhymes, (word) => {
            if (syllable) {
                return word.numSyllables == wordSyl &&
                    word.score >= SIMILAR_SCORE_CONSTANT;
            } else {
                return word.score >= SIMILAR_SCORE_CONSTANT;
            }
        });
        // Don't want to pick any duplicate replacement words
        _.forEach(this.wordsDone, (removeWord) => {
            rhymes = _.filter(rhymes, (rhymeWord) => removeWord != rhymeWord.word);
        });
        // Logic for no rhymes is try again without same syllable, then fail
        if (rhymes.length == 0) {
            if (syllable) {
                return this.filterRhymes(rawRhymes, wordSyl, false);
            } else {
                return false;
            }
        }

        return rhymes;
    }
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

module.exports = router;
