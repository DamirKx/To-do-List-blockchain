// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title TodoList — простой смарт-контракт для хранения задач в блокчейне
contract TodoList {

    struct Task {
        uint    id;
        string  title;
        string  description;
        string  category;
        string  date;
        bool    isDone;
        bool    exists;
        address owner;
    }

    uint public taskCount = 0;

    // id задачи => Task
    mapping(uint => Task) private tasks;

    // адрес => список id задач владельца
    mapping(address => uint[]) private ownerTasks;

    event TaskAdded(uint indexed id, string title, address indexed owner);
    event TaskCompleted(uint indexed id);
    event TaskDeleted(uint indexed id);

    modifier taskExists(uint _id) {
        require(tasks[_id].exists, "Task does not exist");
        _;
    }

    modifier onlyOwner(uint _id) {
        require(tasks[_id].owner == msg.sender, "Not the task owner");
        _;
    }

    /// @notice Добавить новую задачу
    function addTask(
        string memory _title,
        string memory _description,
        string memory _category,
        string memory _date
    ) public {
        require(bytes(_title).length > 0, "Title cannot be empty");

        tasks[taskCount] = Task({
            id:          taskCount,
            title:       _title,
            description: _description,
            category:    _category,
            date:        _date,
            isDone:      false,
            exists:      true,
            owner:       msg.sender
        });

        ownerTasks[msg.sender].push(taskCount);

        emit TaskAdded(taskCount, _title, msg.sender);
        taskCount++;
    }

    /// @notice Отметить задачу выполненной
    function completeTask(uint _id) public taskExists(_id) onlyOwner(_id) {
        tasks[_id].isDone = true;
        emit TaskCompleted(_id);
    }

    /// @notice Удалить задачу
    function deleteTask(uint _id) public taskExists(_id) onlyOwner(_id) {
        tasks[_id].exists = false;
        emit TaskDeleted(_id);
    }

    /// @notice Получить данные одной задачи по id
    function getTask(uint _id) public view taskExists(_id) returns (
        uint id,
        string memory title,
        string memory description,
        string memory category,
        string memory date,
        bool isDone,
        address owner
    ) {
        Task memory t = tasks[_id];
        return (t.id, t.title, t.description, t.category, t.date, t.isDone, t.owner);
    }

    /// @notice Получить все id задач текущего пользователя
    function getMyTaskIds() public view returns (uint[] memory) {
        return ownerTasks[msg.sender];
    }
}
