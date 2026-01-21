def minimum_assignment(costs: list[list[float]]) -> list[int]:
    """Return one column per row using a minimum-cost bipartite assignment."""
    if not costs:
        return []
    rows = len(costs)
    columns = len(costs[0])
    if rows > columns or any(len(row) != columns for row in costs):
        raise ValueError("Assignment matrix must be rectangular with rows <= columns.")
    row_potential = [0.0] * (rows + 1)
    column_potential = [0.0] * (columns + 1)
    assigned_row = [0] * (columns + 1)
    previous_column = [0] * (columns + 1)
    for row in range(1, rows + 1):
        assigned_row[0] = row
        current_column = 0
        minimum = [float("inf")] * (columns + 1)
        used = [False] * (columns + 1)
        while True:
            used[current_column] = True
            current_row = assigned_row[current_column]
            delta = float("inf")
            next_column = 0
            for column in range(1, columns + 1):
                if used[column]:
                    continue
                candidate = (
                    costs[current_row - 1][column - 1]
                    - row_potential[current_row]
                    - column_potential[column]
                )
                if candidate < minimum[column]:
                    minimum[column] = candidate
                    previous_column[column] = current_column
                if minimum[column] < delta:
                    delta = minimum[column]
                    next_column = column
            for column in range(columns + 1):
                if used[column]:
                    row_potential[assigned_row[column]] += delta
                    column_potential[column] -= delta
                else:
                    minimum[column] -= delta
            current_column = next_column
            if assigned_row[current_column] == 0:
                break
        while True:
            prior = previous_column[current_column]
            assigned_row[current_column] = assigned_row[prior]
            current_column = prior
            if current_column == 0:
                break
    result = [-1] * rows
    for column in range(1, columns + 1):
        if assigned_row[column]:
            result[assigned_row[column] - 1] = column - 1
    return result
