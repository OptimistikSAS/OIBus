const gulp = require('gulp')
const zip = require('gulp-zip')
const fs = require('fs')
const merge = require('merge-stream')
const awspublish = require('gulp-awspublish')

const packageJson = JSON.parse(fs.readFileSync('./package.json'))

/**
 * Create a publisher to the specified bucketPath
 * @param {String} bucketPath bucketPath
 * @return {Object} awspublish
 */
function createAwsPublisher(bucketPath) {
  return awspublish.create({
    region: 'eu-central-1',
    params: { Bucket: `optimistik.repository/oibus/${bucketPath}` },
  })
}

/**
 * Gulp task that will take for each distribution the content of dist zip it and send it to S3
 */
gulp.task('build-archives', () => {
  const distributionInfo = {
    win: { distPath: './dist/win/**', packagePath: './dist/package/win/', archiveName: 'OIBus-win32x64' },
    macos: { distPath: './dist/macos/**', packagePath: './dist/package/macos/', archiveName: 'OIBus-macos' },
    linux: { distPath: './dist/linux/**', packagePath: './dist/package/linux/', archiveName: 'OIBus-linux' },
  }

  const streams = []

  Object.entries(distributionInfo).forEach(([distribution, info]) => {
    streams.push(
      gulp
        .src(info.distPath)
        .pipe(zip(`${info.archiveName}-${packageJson.version}.zip`))
        .pipe(gulp.dest(info.packagePath))
        .pipe(createAwsPublisher(distribution).publish()),
    )
  })

  return merge(streams)
})
