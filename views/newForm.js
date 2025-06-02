<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Create New Form</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" />
</head>
<body class="bg-light">
  <div class="container py-5">
    <h1 class="mb-4">Create a New IF-AT Form</h1>
    <p>
      <a href="/console/dashboard" class="btn btn-secondary">Back to Dashboard</a>
    </p>

    <form method="post" action="/console/new" onsubmit="prepareCorrectAnswers()">
      <div class="mb-3">
        <label for="quizTitle" class="form-label">Quiz Title:</label>
        <input 
          type="text" 
          name="quizTitle" 
          id="quizTitle" 
          class="form-control"
          placeholder="e.g. Chapter 3 Quiz"
          required
        />
      </div>

      <div class="mb-3">
        <label for="questionCount" class="form-label">Number of Questions (1-10):</label>
        <input 
          type="number" 
          name="questionCount" 
          id="questionCount" 
          min="1" 
          max="10" 
          class="form-control" 
          required 
          value="1"
        />
      </div>

      <div class="mb-3">
        <label for="optionCount" class="form-label">Number of Options (4 or 5):</label>
        <input 
          type="number" 
          name="optionCount" 
          id="optionCount" 
          min="4" 
          max="5" 
          class="form-control" 
          required 
          value="4"
        />
      </div>

      <div class="mb-3" id="answerFields"></div>

      <input type="hidden" name="correctAnswers" id="correctAnswers" />

      <button type="submit" class="btn btn-primary">Create Form</button>
    </form>
  </div>

  <script>
    function generateAnswerFields() {
      const qCount = parseInt(document.getElementById('questionCount').value, 10) || 0;
      const oCount = parseInt(document.getElementById('optionCount').value, 10) || 0;
      const container = document.getElementById('answerFields');
      container.innerHTML = '';

      const letters = ['A','B','C','D','E'];

      for (let i = 0; i < qCount; i++) {
        const div = document.createElement('div');
        div.classList.add('mb-2');

        const label = document.createElement('label');
        label.textContent = `Question ${i + 1} correct answer: `;
        label.classList.add('form-label', 'me-2');

        const select = document.createElement('select');
        select.classList.add('form-select', 'd-inline-block', 'w-auto');

        for (let j = 0; j < oCount; j++) {
          const opt = document.createElement('option');
          opt.value = letters[j];
          opt.textContent = letters[j];
          select.appendChild(opt);
        }

        div.appendChild(label);
        div.appendChild(select);
        container.appendChild(div);
      }
    }

    function prepareCorrectAnswers() {
      const selects = document.querySelectorAll('#answerFields select');
      const answers = [];
      selects.forEach(s => answers.push(s.value));
      document.getElementById('correctAnswers').value = answers.join(',');
    }

    document.getElementById('questionCount').addEventListener('change', generateAnswerFields);
    document.getElementById('optionCount').addEventListener('change', generateAnswerFields);

    generateAnswerFields();
  </script>
</body>
</html>
