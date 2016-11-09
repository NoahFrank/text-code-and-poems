const express = require('express');
const router = express.Router();

const datamuse = require('datamuse');
const syllable = require('syllable');
const _ = require('lodash');


const SIMILAR_SCORE_CONSTANT = 500;

/* GET home page. */
router.get('/', function(req, res, next) {
    let test = new Poem(`They put me in the oven to bake.
Me a deprived and miserable cake.
Feeling the heat I started to bubble.
Watching the others I knew I was in orange...`,
        (error, result) => {
            if (error) {
                console.log("ERROR:", error);
            } else {
                console.log(result);
            }
    });
    res.render('index', { title: 'Express' });
});

class Poem {

    constructor(text, cb) {
        this.wordsDone = []; // Keeps track of rhyming words we have found to prevent duplicates

        this.modifyText(text, cb);
    }

    modifyText(text, cb) {
        let lines = _.split(text.trim(), '\n');
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let words = _.split(line, ' ');
            let lastWord = words[words.length - 1].replace(/[^\w]/g,''); // Want to rhyme last word
            this.getRhymeFor(lastWord, (error, word) => {
                if (error) { // An error occurred when getting a rhyme
                    cb(error);
                } else {
                    // Now rejoin line and replace for final text
                    console.log("Found rhyme for", lastWord, ":", word, "at index:", i);
                    words[words.length - 1] = word;
                    lines[i] = _.join(words, ' ');
                    this.wordsDone.push(word); // Add word to done so we can parallel done and no duplicates
                    if (this.wordsDone.length == lines.length) {
                        cb(false, _.join(lines, '\n'));
                    }
                }
            });
        }
    }

    getRhymeFor(word, cb) {
        let wordSyl = syllable(word);
        datamuse.words({
            rel_rhy: word
        }).then((json) => {
            let rhymes = this.filterRhymes(json, wordSyl);
            // Determine if we actually found a rhyme
            if (rhymes) {
                let randIndex = getRandomInt(0, rhymes.length);
                cb(false, rhymes[randIndex].word);
            } else { // We failed to find a rhyme with/out same syllables and >= SIMILAR_SCORE_CONSTANT
                cb("Unable to find appropriate rhyme for " + word);
            }
        }).catch(error => {
            // TODO make server report error in api request, like api is down so we can't work right now
            // TODO: log(error.response.body);
            console.log("ERROR occured with rhyme request");
            cb("API GET request error");
        });
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
