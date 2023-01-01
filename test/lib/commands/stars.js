const t = require('tap')
const realFetch = require('npm-registry-fetch')
const mockNpm = require('../../fixtures/mock-npm')

const noop = () => {}

const mockStars = async (t, { npmFetch = noop, exec = true, ...opts }) => {
  const mock = await mockNpm(t, {
    mocks: {
      'npm-registry-fetch': Object.assign(noop, realFetch, { json: npmFetch }),
      '../../lib/utils/get-identity.js': async () => 'foo',
    },
    ...opts,
  })

  const stars = { exec: (args) => mock.npm.exec('stars', args) }

  if (exec) {
    await stars.exec(Array.isArray(exec) ? exec : [])
    mock.result = mock.joinedOutput()
  }

  return {
    ...mock,
    stars,
    logs: () => mock.logs.filter(l => l[1] === 'stars').map(l => l[2]),
  }
}

t.test('no args', async t => {
  t.plan(3)

  const npmFetch = async (uri, opts) => {
    t.equal(uri, '/-/_view/starredByUser', 'should fetch from expected uri')
    t.equal(opts.query.key, '"foo"', 'should match logged in username')

    return {
      rows: [
        { value: '@npmcli/arborist' },
        { value: '@npmcli/map-workspaces' },
        { value: 'libnpmfund' },
        { value: 'libnpmpublish' },
        { value: 'ipt' },
      ],
    }
  }

  const { result } = await mockStars(t, { npmFetch, exec: true })

  t.matchSnapshot(
    result,
    'should output a list of starred packages'
  )
})

t.test('npm star <user>', async t => {
  t.plan(3)

  const npmFetch = async (uri, opts) => {
    t.equal(uri, '/-/_view/starredByUser', 'should fetch from expected uri')
    t.equal(opts.query.key, '"ruyadorno"', 'should match username')

    return {
      rows: [{ value: '@npmcli/arborist' }],
    }
  }

  const { result } = await mockStars(t, { npmFetch, exec: ['ruyadorno'] })

  t.match(
    result,
    '@npmcli/arborist',
    'should output expected list of starred packages'
  )
})

t.test('unauthorized request', async t => {
  const npmFetch = async () => {
    throw Object.assign(
      new Error('Not logged in'),
      { code: 'ENEEDAUTH' }
    )
  }

  const { joinedOutput, stars, logs } = await mockStars(t, { npmFetch, exec: false })

  await t.rejects(
    stars.exec([]),
    /Not logged in/,
    'should throw unauthorized request msg'
  )

  t.strictSame(
    logs(),
    ['auth is required to look up your username'],
    'should warn auth required msg'
  )

  t.equal(
    joinedOutput(),
    '',
    'should have empty output'
  )
})

t.test('unexpected error', async t => {
  const npmFetch = async () => {
    throw new Error('ERROR')
  }

  const { stars, logs } = await mockStars(t, { npmFetch, exec: false })

  await t.rejects(
    stars.exec([]),
    /ERROR/,
    'should throw unexpected error message'
  )

  t.strictSame(logs(), [], 'no logs')
})

t.test('no pkg starred', async t => {
  const npmFetch = async () => ({ rows: [] })

  const { logs } = await mockStars(t, { npmFetch, exec: true })

  t.strictSame(
    logs(),
    ['user has not starred any packages'],
    'should warn no starred packages msg'
  )
})
