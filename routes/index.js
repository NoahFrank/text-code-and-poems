const express = require('express');
const router = express.Router();

const datamuse = require('datamuse');
const syllable = require('syllable');
const _ = require('lodash');


const SIMILAR_SCORE_CONSTANT = 500;

/* GET home page. */
router.get('/', function(req, res, next) {
    modifyText(`They put me in the oven to bake.
Me a deprived and miserable cake.
Feeling the heat I started to bubble.
Watching the others I knew I was in trouble...`,
        (result) => {
            console.log(result);
    });
    res.render('index', { title: 'Express' });
});




class Poem {

    constructor(text, cb) {
        this.modifiedText = "";
        this.wordsDone = [];

        this.modifyText(text, cb);
    }

    getModifiedText() {
        return this.modifiedText;
    }

    modifyText(text, cb) {
        let lines = _.split(text.trim(), '\n');
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let words = _.split(line, ' ');
            let lastWord = words[words.length - 1].replace(/[^\w]/g,''); // Want to rhyme last word
            this.getRhymeFor(lastWord, (word) => {
                // Now rejoin line and replace for final text
                console.log("Found rhyme for", lastWord, ":", word, "at index:", i);
                words[words.length - 1] = word;
                lines[i] = _.join(words, ' ');
                this.wordsDone.push(word); // Add word to done so we can parallel done and no duplicates
                if (this.wordsDone.length == lines.length) {
                    cb(_.join(lines, '\n'));
                }
            });
        }
    }

    getRhymeFor(word, cb) {
        let wordSyl = syllable(word);
        datamuse.words({
            rel_rhy: word
        }).then((json) => {
            let sameSylRhymes = _.filter(json, (word) => {
                return word.numSyllables == wordSyl &&
                    word.score >= SIMILAR_SCORE_CONSTANT;
            });
            // Don't want to pick the same word we have already gotten
            _.forEach(this.wordsDone, (removeWord) => {
                _.remove(sameSylRhymes, (word) => removeWord === word);
            });
            let randWordIndex = getRandomInt(0, sameSylRhymes.length);
            cb(sameSylRhymes[randWordIndex].word);
        }).catch(error => {
            console.log(error.response.body);
            console.log("ERROR occured with rhyme request");
            // TODO make server report error in api request, like api is down so we can't work right now
            //=> 'Internal server error ...'
        });
    }
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

module.exports = router;
