import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {progress, task} from '../routes';
import {BehaviorSubject, from, Observable, of, ReplaySubject, Subject} from 'rxjs';
import {pluck, scan, shareReplay, tap} from 'rxjs/operators';
import {distinctUntilChanged, filter, find, first, map, mergeMap, switchMap, toArray} from 'rxjs/internal/operators';
import {TaskModel} from '../models';

@Injectable()
export class TaskService {

  private progressSubject = new Subject<Record<number, boolean>>();
  private progress$: Observable<Record<number, boolean>> = this.progressSubject.pipe(
    scan((total, current) => ({...total, ...current}), {}),
    shareReplay(1)
  );
  private tasksSubject = new BehaviorSubject<TaskModel[]>([]);
  private $tasks: Observable<TaskModel[]> = this.tasksSubject.asObservable();

  constructor(private http: HttpClient) {
  }

  saveTask(taskId: number, code: string, correct?: boolean) {
    const data: SaveTaskModel = {taskId, code, correct};
    this.http.post(task, data).pipe(
      tap(() => {
        if (typeof correct === 'boolean') {
          this.progressSubject.next({[taskId]: correct});
        }
      })
    ).subscribe(() => this.updateTask(data));
  }

  private updateTask(t: SaveTaskModel): void {
    const arr = [... this.tasksSubject.getValue()];
    const index = arr.findIndex(x => t.taskId === x.taskId);

    if (index !== -1) {
      const el = {...arr[index]};
      el.correct = t.correct;
      el.code = t.code;
      arr[index] = el;
    }
    this.tasksSubject.next(arr);
  }

  private addTask(t: TaskModel): void {
    const arr = [... this.tasksSubject.getValue()];
    const index = arr.findIndex(x => t.taskId === x.taskId);

    if (index !== -1) {
      arr.splice(index, 1);
    }

    arr.push({...t});

    this.tasksSubject.next(arr);
  }

  fetchTasks(list: TaskModel[]) {
    return of(...list).pipe(
      mergeMap(t => this.getTask(t.taskId)),
      map(t => {
        const local = list.find(x => x.taskId === t.taskId);

        if (local) {
          local.code = t.code;
          local.correct = t.correct;
        }

        return local;
      }),
      toArray(),
      tap(tasks => this.tasksSubject.next(tasks))
    );
  }

  getTask(id: number) {
    return this.http.get<TaskResultModel>(task, {params: new HttpParams().append('taskId', `${id}`)})
      .pipe(
        map( (res: TaskResultModel) => {
          return {...res, taskId: id};
        })
      );
  }

  loadProgress(): void {
    this.http.get<{ correct: number[], incorrect: number[] }>(progress)
      .subscribe(({correct, incorrect}) => this.progressSubject.next(reduceWith(correct, true, reduceWith(incorrect, false))));
  }

  isTaskCorrect(id: number) {
    return this.progress$.pipe(
      pluck(id),
    );
  }

  fetchTask(taskId: number) {
    return this.$tasks
      .pipe(
        mergeMap((tasks: TaskModel[]) => from(tasks)),
        filter(x => x.taskId === taskId)
        );
  }
}

function reduceWith(keys: number[], value: boolean, seed = {}) {
  return keys.reduce((acc, key) => (acc[key] = value, acc), seed);
}

export interface SaveTaskModel {
  taskId: number;
  code: string;
  correct?: boolean;
}

export interface TaskResultModel {
  correct: boolean | null;
  code: string;
}
