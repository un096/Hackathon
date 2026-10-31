// Assessment bank. Practical assessments are controlled scenarios (code reading, debugging,
// query design) graded against a fixed key — candidates never run code on the server.
// q(prompt, options, correctIndex, explanation, difficulty, codeSnippet)
const q = (prompt, options, correct, explanation, difficulty = 2, code = null) => ({ prompt, options, correct, explanation, difficulty, code });

module.exports = [
  {
    skill: 'react', type: 'MCQ', title: 'React Fundamentals', durationMins: 12,
    description: 'Components, props, state, hooks and rendering behaviour.',
    questions: [
      q('Which hook should you use to run a side effect after render, such as fetching data?', ['useMemo', 'useEffect', 'useRef', 'useId'], 1, 'useEffect runs after the component renders and is the standard place for side effects.', 1),
      q('Why does React require a stable "key" prop on list items?', ['To style each item', 'To let React identify items between renders and reconcile efficiently', 'To make items focusable', 'It is only required for class components'], 1, 'Keys let React match elements across renders so it can reorder/update instead of re-creating them.', 2),
      q('What happens when you call a state setter with the same value (Object.is equal) as the current state?', ['React always re-renders all children', 'React may bail out of re-rendering that component', 'An error is thrown', 'The state becomes undefined'], 1, 'React compares with Object.is and can skip re-rendering when the value has not changed.', 3),
      q('Which statement about props is correct?', ['A child component may mutate its props', 'Props are read-only inputs passed from the parent', 'Props can only be strings', 'Props are global to the app'], 1, 'Props are read-only; to change data the parent passes new props or the child uses state.', 1),
      q('What is the main purpose of useMemo?', ['To store DOM references', 'To memoise an expensive computed value between renders', 'To subscribe to context', 'To replace useState'], 1, 'useMemo caches the result of a calculation until its dependencies change.', 2),
      q('In React 18+, multiple state updates inside a setTimeout callback are…', ['Never batched', 'Automatically batched into one render', 'Applied in reverse order', 'Ignored'], 1, 'React 18 introduced automatic batching for updates in timeouts, promises and native handlers.', 3),
    ],
  },
  {
    skill: 'react', type: 'PRACTICAL', title: 'React Practical: Debug & Design', durationMins: 15,
    description: 'Read real component code, find the bug and choose the correct fix.',
    questions: [
      q('This counter shows 1 after clicking once, even though addThree() is called. What is the fix?', ['Call setCount(count + 3)', 'Use the updater form: setCount(c => c + 1) three times', 'Wrap in useEffect', 'Use useRef instead of useState'], 1, 'Each setCount(count + 1) reads the same stale "count"; the updater form chains from the latest value.', 3,
        'function Counter() {\n  const [count, setCount] = useState(0);\n  function addThree() {\n    setCount(count + 1);\n    setCount(count + 1);\n    setCount(count + 1);\n  }\n  return <button onClick={addThree}>{count}</button>;\n}'),
      q('This effect causes an infinite request loop. Why?', ['fetch is synchronous', 'The dependency array contains an object re-created on every render', 'useEffect cannot call fetch', 'setUsers must be awaited'], 1, '"filters" is a new object each render, so the effect re-runs every render and setUsers triggers another render.', 3,
        'function Users({ role }) {\n  const [users, setUsers] = useState([]);\n  const filters = { role };\n  useEffect(() => {\n    fetch(`/api/users?role=${filters.role}`)\n      .then(r => r.json()).then(setUsers);\n  }, [filters]);\n  return <List items={users} />;\n}'),
      q('A search box should call the API only after the user stops typing for 300 ms. Which approach is correct?', ['Call the API in render', 'useEffect with a setTimeout and a cleanup that clears it', 'useMemo around fetch', 'Disable the input while typing'], 1, 'The cleanup cancels the previous timer on every keystroke, leaving only the last one (debounce).', 2),
      q('Which change prevents this list from re-rendering every row when one item is toggled?', ['Use index as key', 'Wrap Row in React.memo and pass a stable onToggle (useCallback)', 'Convert to a class component', 'Move state into each Row with useRef'], 1, 'React.memo skips rows whose props are unchanged; useCallback keeps the handler reference stable.', 4,
        'const Row = ({ item, onToggle }) => <li onClick={() => onToggle(item.id)}>{item.label}</li>;\nfunction List({ items, setItems }) {\n  const onToggle = id => setItems(xs => xs.map(x => x.id === id ? { ...x, on: !x.on } : x));\n  return items.map(i => <Row key={i.id} item={i} onToggle={onToggle} />);\n}'),
      q('Where should server data that several unrelated pages need be cached?', ['In each component\'s local state', 'In a shared server-state cache such as TanStack Query', 'In localStorage only', 'In a global variable on window'], 1, 'A server-state cache deduplicates requests, caches and refetches consistently across pages.', 2),
    ],
  },
  {
    skill: 'nodejs', type: 'MCQ', title: 'Node.js & Express Fundamentals', durationMins: 12,
    description: 'Event loop, modules, async patterns and Express middleware.',
    questions: [
      q('Which statement best describes the Node.js event loop?', ['Each request gets its own OS thread', 'A single-threaded loop that processes callbacks while I/O runs asynchronously', 'It runs JavaScript on the GPU', 'It blocks until each file read completes'], 1, 'Node runs JS on one thread; I/O is delegated (libuv) and callbacks are queued back to the loop.', 1),
      q('In Express, what must a middleware do if it does not end the response?', ['Return true', 'Call next()', 'Throw an error', 'Call res.next()'], 1, 'Middleware passes control to the next handler by calling next().', 1),
      q('What is the output order?  setTimeout(() => log("A"), 0); Promise.resolve().then(() => log("B")); log("C");', ['A B C', 'C B A', 'C A B', 'B C A'], 1, 'Synchronous code first (C), then microtasks (B), then timers (A).', 3),
      q('Which is the safest way to store user passwords?', ['Base64 encode them', 'Hash with a slow adaptive algorithm such as bcrypt', 'Encrypt with a key stored in the code', 'Store plain text in a private table'], 1, 'Adaptive hashes (bcrypt/argon2) with salts resist brute force; passwords should never be reversible.', 2),
      q('Express error-handling middleware is recognised by…', ['Its name ending in Error', 'Having four arguments (err, req, res, next)', 'Being registered first', 'Returning a Promise'], 1, 'Express treats middleware with arity 4 as an error handler.', 2),
      q('Which HTTP status should an API return when an authenticated user lacks permission?', ['401', '403', '404', '500'], 1, '401 means not authenticated; 403 means authenticated but not allowed.', 2),
    ],
  },
  {
    skill: 'nodejs', type: 'PRACTICAL', title: 'Node.js Practical: API Debugging', durationMins: 15,
    description: 'Diagnose real backend code paths: async errors, security and performance.',
    questions: [
      q('This route sometimes crashes the process with an unhandled rejection. Best fix?', ['Add process.exit on error', 'Wrap in try/catch (or an async error wrapper) and pass errors to next(err)', 'Remove async', 'Increase the server timeout'], 1, 'Rejected promises in Express 4 handlers are not caught automatically; forward them to the error middleware.', 3,
        "app.get('/orders/:id', async (req, res) => {\n  const order = await db.order.findUnique({ where: { id: req.params.id } });\n  res.json(order.items);\n});"),
      q('What is the vulnerability here?', ['None', 'SQL injection via string concatenation', 'Cross-site scripting in JSON', 'Missing CORS header'], 1, 'User input is concatenated into SQL; use parameterised queries.', 2,
        "const rows = await pool.query(\"SELECT * FROM users WHERE email = '\" + req.query.email + \"'\");"),
      q('This endpoint is slow: it awaits 3 independent HTTP calls sequentially. Best improvement?', ['Use a for loop', 'Run them concurrently with Promise.all', 'Use setTimeout', 'Make them synchronous'], 1, 'Independent awaits can run in parallel; total time becomes the slowest call instead of the sum.', 3,
        'const a = await getProfile(id);\nconst b = await getOrders(id);\nconst c = await getInvoices(id);'),
      q('An Express API trusts req.body.role to decide admin access. What is the correct design?', ['Keep it but hide the field in the UI', 'Derive the role from the verified token/database on the server for every request', 'Encrypt the role in localStorage', 'Check the role only in React routes'], 1, 'Authorization must use server-side identity; client-supplied roles can be forged.', 4),
    ],
  },
  {
    skill: 'python', type: 'MCQ', title: 'Python Fundamentals', durationMins: 12,
    description: 'Data structures, functions, error handling and idioms.',
    questions: [
      q('What does this print?  x = [1, 2, 3]; y = x; y.append(4); print(len(x))', ['3', '4', 'Error', '1'], 1, 'y references the same list object as x, so x also has 4 elements.', 2),
      q('Which data structure gives average O(1) membership tests?', ['list', 'set', 'tuple', 'str'], 1, 'Sets (hash tables) provide average constant-time membership checks.', 1),
      q('What is the problem with  def add(item, bucket=[]): bucket.append(item); return bucket ?', ['Syntax error', 'The default list is shared across calls', 'append is not a list method', 'Nothing'], 1, 'Default arguments are evaluated once; use bucket=None and create a new list inside.', 3),
      q('Which statement correctly opens a file and guarantees it is closed?', ['f = open(p); f.read()', 'with open(p) as f: data = f.read()', 'open(p).close().read()', 'file(p).read()'], 1, 'The with statement (context manager) closes the file even if an exception occurs.', 1),
      q('What does  [n * n for n in range(5) if n % 2 == 0]  produce?', ['[0, 4, 16]', '[1, 9]', '[0, 1, 4, 9, 16]', '[4, 16]'], 0, 'Even n in 0..4 are 0, 2, 4 → squares 0, 4, 16.', 2),
    ],
  },
  {
    skill: 'python', type: 'PRACTICAL', title: 'Python Practical: Data Processing', durationMins: 15,
    description: 'Read data-processing code and choose correct, efficient fixes.',
    questions: [
      q('This function is very slow on 1M rows. Best fix?', ['Use a while loop', 'Convert "blocked" to a set before the loop', 'Sort rows first', 'Use recursion'], 1, '"x in list" is O(n); a set makes each lookup O(1).', 3,
        'def clean(rows, blocked_ids):\n    # blocked_ids is a list of 50k ids\n    return [r for r in rows if r["id"] not in blocked_ids]'),
      q('In pandas, which expression keeps rows where salary > 50000 AND dept == "Data"?', ['df[df.salary > 50000 and df.dept == "Data"]', 'df[(df.salary > 50000) & (df.dept == "Data")]', 'df.where(salary > 50000, dept="Data")', 'df.filter(salary > 50000)'], 1, 'Element-wise conditions use & with parentheses; Python "and" fails on Series.', 2),
      q('What does this code print?', ['{"a": 1}', '{"a": 2}', 'KeyError', '{"a": 1, "b": 2}'], 1, 'dict.update overwrites the existing key "a" with 2.', 2,
        'cfg = {"a": 1}\ncfg.update({"a": 2})\nprint(cfg)'),
      q('A job parses 10 GB CSV and runs out of memory. Best approach?', ['Read it all with read_csv', 'Process it in chunks (chunksize=) and aggregate incrementally', 'Convert to JSON first', 'Increase recursion limit'], 1, 'Chunked reading keeps memory bounded while still processing every row.', 4),
    ],
  },
  {
    skill: 'postgresql', type: 'MCQ', title: 'PostgreSQL & SQL Fundamentals', durationMins: 12,
    description: 'Joins, aggregation, indexes and transactions.',
    questions: [
      q('Which join returns all rows from the left table plus matches from the right?', ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'SELF JOIN'], 1, 'LEFT JOIN keeps every left row and fills NULLs where no match exists.', 1),
      q('Which clause filters groups after aggregation?', ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'], 1, 'HAVING filters aggregated groups; WHERE filters rows before grouping.', 1),
      q('What does a UNIQUE constraint on (organization_id, email) guarantee?', ['Emails are unique globally', 'The same email cannot appear twice within one organization', 'Emails cannot be NULL', 'Nothing unless indexed separately'], 1, 'A composite unique constraint enforces uniqueness of the combination.', 2),
      q('Which isolation behaviour does PostgreSQL use by default?', ['READ UNCOMMITTED', 'READ COMMITTED', 'SERIALIZABLE', 'SNAPSHOT ONLY'], 1, 'PostgreSQL defaults to READ COMMITTED.', 3),
      q('A query filters  WHERE lower(email) = $1  and is slow. Which index helps?', ['CREATE INDEX ON users(email)', 'CREATE INDEX ON users (lower(email))', 'A GIN index on id', 'No index can help'], 1, 'An expression index on lower(email) matches the predicate exactly.', 4),
    ],
  },
  {
    skill: 'postgresql', type: 'PRACTICAL', title: 'PostgreSQL Practical: Query Design', durationMins: 15,
    description: 'Choose correct queries and schema fixes for real reporting tasks.',
    questions: [
      q('Which query returns each department with its employee count, including departments with zero employees?', ['SELECT d.name, COUNT(*) FROM departments d JOIN employees e ON e.dept_id = d.id GROUP BY d.name', 'SELECT d.name, COUNT(e.id) FROM departments d LEFT JOIN employees e ON e.dept_id = d.id GROUP BY d.name', 'SELECT name, COUNT(id) FROM employees GROUP BY name', 'SELECT d.name, SUM(e.id) FROM departments d LEFT JOIN employees e ON true GROUP BY d.name'], 1, 'LEFT JOIN keeps empty departments, and COUNT(e.id) counts 0 for NULL matches (COUNT(*) would count 1).', 3),
      q('Two requests can create duplicate bookings for the same seat. Most reliable fix?', ['Check with SELECT first in the API', 'Add a UNIQUE constraint on (show_id, seat_no) and handle the conflict', 'Add a sleep', 'Use a bigger connection pool'], 1, 'Only a database constraint closes the race condition between check and insert.', 4),
      q('EXPLAIN shows a sequential scan on orders(customer_id) for a query run 1,000s of times/min. What do you add?', ['A trigger', 'A B-tree index on orders(customer_id)', 'A view', 'A sequence'], 1, 'A B-tree index enables index scans for equality lookups on customer_id.', 2),
      q('Which query returns the latest order per customer?', ['SELECT * FROM orders ORDER BY created_at DESC LIMIT 1', 'SELECT DISTINCT ON (customer_id) * FROM orders ORDER BY customer_id, created_at DESC', 'SELECT MAX(*) FROM orders GROUP BY customer_id', 'SELECT * FROM orders GROUP BY customer_id'], 1, 'DISTINCT ON keeps the first row per customer given the ORDER BY.', 3),
    ],
  },
  {
    skill: 'javascript', type: 'MCQ', title: 'JavaScript Essentials', durationMins: 10,
    description: 'Scope, closures, async/await and equality.',
    questions: [
      q('What is the value of  typeof null ?', ['"null"', '"object"', '"undefined"', '"number"'], 1, 'A historic quirk: typeof null is "object".', 1),
      q('What does  [1, 2, 3].map(n => n * 2)  return?', ['[1, 2, 3]', '[2, 4, 6]', '12', 'undefined'], 1, 'map returns a new array with each element transformed.', 1),
      q('Which keyword declares a block-scoped variable that cannot be reassigned?', ['var', 'let', 'const', 'static'], 2, 'const is block-scoped and cannot be reassigned (objects can still be mutated).', 1),
      q('What does an async function always return?', ['undefined', 'A Promise', 'A callback', 'The awaited value synchronously'], 1, 'Async functions wrap their return value in a Promise.', 2),
      q('What is the result of  0.1 + 0.2 === 0.3 ?', ['true', 'false', 'TypeError', 'NaN'], 1, 'Floating point rounding gives 0.30000000000000004.', 2),
    ],
  },
  {
    skill: 'docker', type: 'MCQ', title: 'Docker Essentials', durationMins: 10,
    description: 'Images, containers, layers and networking.',
    questions: [
      q('What is the difference between an image and a container?', ['They are identical', 'An image is a read-only template; a container is a running instance of it', 'A container builds images', 'Images run only on Linux'], 1, 'Containers are instances created from images with a writable layer.', 1),
      q('Why copy package.json and install dependencies before copying source code in a Dockerfile?', ['It is required syntax', 'To reuse the cached dependency layer when only source changes', 'To shrink the base image', 'To run as root'], 1, 'Layer caching skips reinstalling dependencies when they did not change.', 3),
      q('Which flag maps host port 8080 to container port 80?', ['-v 8080:80', '-p 8080:80', '-e 8080=80', '--link 8080:80'], 1, '-p host:container publishes ports.', 1),
      q('Where should database data live so it survives container removal?', ['In the container filesystem', 'In a named volume or bind mount', 'In an environment variable', 'In the image'], 1, 'Volumes persist independently of the container lifecycle.', 2),
      q('What does a multi-stage build mainly achieve?', ['Faster networking', 'Smaller final images without build tools', 'Running two containers', 'Automatic scaling'], 1, 'Build in one stage, copy only artefacts into a slim runtime stage.', 3),
    ],
  },
  {
    skill: 'aws', type: 'MCQ', title: 'AWS Cloud Fundamentals', durationMins: 10,
    description: 'Core services, IAM and architecture basics.',
    questions: [
      q('Which service provides object storage?', ['EC2', 'S3', 'RDS', 'VPC'], 1, 'S3 is AWS object storage.', 1),
      q('What is the recommended way to give an EC2 instance access to S3?', ['Hard-code access keys in the app', 'Attach an IAM role to the instance', 'Make the bucket public', 'Use the root account'], 1, 'Instance roles provide temporary credentials without storing keys.', 2),
      q('Deploying across multiple Availability Zones primarily improves…', ['Cost', 'High availability / fault tolerance', 'Latency to all users globally', 'Encryption'], 1, 'Multi-AZ protects against a single data-centre failure.', 2),
      q('Which service runs code without managing servers, billed per invocation?', ['Lambda', 'EBS', 'CloudFront', 'Route 53'], 0, 'AWS Lambda is the serverless compute service.', 1),
      q('Principle of least privilege in IAM means…', ['Give everyone admin for speed', 'Grant only the permissions needed for the task', 'Use one shared user', 'Disable MFA'], 1, 'Limit permissions to what is necessary to reduce blast radius.', 2),
    ],
  },
  {
    skill: 'machine-learning', type: 'MCQ', title: 'Machine Learning Fundamentals', durationMins: 12,
    description: 'Model evaluation, overfitting and feature engineering.',
    questions: [
      q('A model scores 99% on training data and 70% on test data. This indicates…', ['Underfitting', 'Overfitting', 'Data leakage is impossible', 'Perfect generalisation'], 1, 'A large train/test gap indicates the model memorised training data.', 2),
      q('For a fraud dataset with 1% positives, which metric is most informative?', ['Accuracy', 'Precision/recall (or PR-AUC)', 'Mean squared error', 'R²'], 1, 'Accuracy is misleading with heavy class imbalance.', 3),
      q('Why split data into train / validation / test sets?', ['To use less data', 'To tune on validation and get an unbiased final estimate on test', 'Because models require three files', 'To speed up training'], 1, 'Test data must stay unseen during tuning to estimate generalisation.', 2),
      q('Which technique reduces overfitting in linear models?', ['Removing the intercept', 'Regularisation (L1/L2)', 'Increasing learning rate', 'Duplicating rows'], 1, 'Regularisation penalises large weights.', 2),
      q('Fitting a StandardScaler on the full dataset before splitting causes…', ['Faster training', 'Data leakage from test into training', 'Better test scores that are valid', 'Nothing'], 1, 'Fit preprocessing on training data only, then transform validation/test.', 4),
    ],
  },
  {
    skill: 'java', type: 'MCQ', title: 'Java Fundamentals', durationMins: 10,
    description: 'OOP, collections and exceptions.',
    questions: [
      q('Which collection does not allow duplicate elements?', ['ArrayList', 'HashSet', 'LinkedList', 'Vector'], 1, 'Set implementations reject duplicates.', 1),
      q('What does the "final" keyword on a variable mean?', ['It is garbage collected first', 'It can be assigned only once', 'It is public', 'It is static'], 1, 'A final variable cannot be reassigned after initialisation.', 1),
      q('Comparing two String objects for equal content should use…', ['==', '.equals()', '.hashCode()', '.compareTo() == 1'], 1, '== compares references; equals compares content.', 2),
      q('Which is a checked exception?', ['NullPointerException', 'IOException', 'ArithmeticException', 'IllegalArgumentException'], 1, 'IOException must be declared or caught.', 2),
      q('What must you override together with equals() for objects used as HashMap keys?', ['toString()', 'hashCode()', 'clone()', 'finalize()'], 1, 'Equal objects must have equal hash codes.', 3),
    ],
  },
  {
    skill: 'typescript', type: 'MCQ', title: 'TypeScript Essentials', durationMins: 10,
    description: 'Types, interfaces, generics and narrowing.',
    questions: [
      q('What does the type  string | number  mean?', ['Both at once', 'Either a string or a number', 'A tuple', 'Any type'], 1, 'A union type accepts either member.', 1),
      q('Which is safer for values of unknown shape coming from an API?', ['any', 'unknown (then narrow)', 'never', 'void'], 1, 'unknown forces checks before use; any disables type checking.', 2),
      q('What does a generic  function first<T>(xs: T[]): T  provide?', ['Runtime type checks', 'A return type tied to the element type of the input', 'Faster code', 'Only works with numbers'], 1, 'Generics preserve type relationships between inputs and outputs.', 2),
      q('Which operator narrows a union by checking a property exists?', ['typeof', 'in', 'instanceof only', 'as'], 1, 'The "in" operator narrows based on property presence.', 3),
      q('TypeScript types at runtime are…', ['Enforced by the JS engine', 'Erased — checking happens at compile time', 'Converted to classes', 'Stored in JSON'], 1, 'Types are erased during compilation.', 2),
    ],
  },
];
