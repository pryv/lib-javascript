var package = require('./package.json'),
    distRoot = './dist/',
    currentDistPath = distRoot + package.version + '/',
    latestDistPath = distRoot + 'latest/';

module.exports = function (grunt) {

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks('grunt-env');

  grunt.initConfig({
    pkg: package,

    browserify: {
      dist: {
        src: ['./source/main.js'],
        dest: currentDistPath + 'pryv.js',
        options: {
          alias: ['./source/main.js:pryv'],
          ignore: [ './source/system/*-node.js', './source/utility/*-node.js' ],
          browserifyOptions: {
            standalone: 'pryv'
          }
        }
      }
    },

    jsdoc : {
      dist : {
        src: [ 'README.md', 'source/**/*.*' ],
        options : {
          destination : currentDistPath + 'docs',
          configure: 'doc-src/jsdoc.conf',
          private: false
        }
      }
    },

    copy: {
      assetsToDist: {
        files: [
          {
            expand: true,
            flatten: true,
            filter: 'isFile',
            src: 'source/assets/**',
            dest: currentDistPath + 'assets/'
          }
        ]
      },
      updateLatestDist: {
        files: [
          {
            expand: true,
            cwd: currentDistPath,
            src: '**',
            dest: latestDistPath
          }
        ]
      }
    },

    env : {
      record: {
        REPLAY : 'record'
      }
    },

    mochaTest: {
      acceptance: {
        src: ['test/acceptance/**/*.test.js'],
        options: {
          reporter: 'spec'
        }
      },
      other: {
        src: ['test/other/**/*.test.js'],
        options: {
          reporter: 'spec'
        }
      },
      coverage: {
        src: ['test/**/*.test.js'],
        options: {
          require: [ './test/blanket', './source/main.js' ],
          quiet: true,
          reporter: 'html-cov',
          captureFile: 'test/coverage.html'
        }
      }
    },

    watch: {
      all: {
        files: [ 'source/**/*.*', 'test/**/*.*' ],
        tasks: ['test']
      }
    }
  });

  grunt.registerTask('default', [ 'browserify', 'jsdoc', 'copy', 'mochaTest' ]);
  grunt.registerTask('test', [ 'browserify', 'copy', 'mochaTest' ]);
  grunt.registerTask('test:acceptance', [ 'browserify', 'copy', 'mochaTest:acceptance' ]);
  grunt.registerTask('record', [ 'browserify', 'copy', 'env:record', 'mochaTest' ]);
};
